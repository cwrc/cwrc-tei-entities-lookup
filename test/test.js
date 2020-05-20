'use strict';

import fetchMock from 'fetch-mock';
import cwrcLookup from '../src/index.js';

const emptyResultFixture = JSON.stringify(require('./httpResponseMocks/noResults.json'));
const resultsFixture = JSON.stringify(require('./httpResponseMocks/results.json'));
const projectResultsFixture = JSON.stringify(require('./httpResponseMocks/projectResults.json'));

const searchRoot = 'https://beta.cwrc.ca/';
const entityRoot = 'https://commons.cwrc.ca/';

const projectLogoRoot = 'https://beta.cwrc.ca/sites/default/files';
const projectLookupUrl = 'foobar';
const cwrcProjectId = 'cwrc:cwrc';

cwrcLookup.setSearchRoot(searchRoot);
cwrcLookup.setEntityRoot(entityRoot);

const queryString = 'john';
const queryStringWithNoResults = 'ldfjk';
const queryStringForTimeout = 'chartrand';
const queryStringForError = 'cuff';
const expectedResultLength = 10;

jest.useFakeTimers();

// setup server mocks

let uriBuilderFn = cwrcLookup.getPersonLookupURI;

fetchMock.get(uriBuilderFn(queryString), resultsFixture);
fetchMock.get(uriBuilderFn(queryStringWithNoResults), emptyResultFixture);
fetchMock.get(uriBuilderFn(queryStringForTimeout), () => {
	setTimeout(Promise.resolve, 8100);
});
fetchMock.get(uriBuilderFn(queryStringForError), 500);

fetchMock.get(projectLookupUrl, projectResultsFixture);

// from https://stackoverflow.com/a/35047888
const doObjectsHaveSameKeys = (...objects) => {
	const allKeys = objects.reduce((keys, object) => keys.concat(Object.keys(object)),[]);
	const union = new Set(allKeys);
	return objects.every((object) => union.size === Object.keys(object).length);
};

test('lookup builder', () => {
	expect.assertions(1);
	expect(cwrcLookup.getPersonLookupURI(queryString).includes(queryString)).toBe(true);
});

test('get/set roots', () => {
	expect.assertions(2);
	expect(cwrcLookup.getSearchRoot()).toBe(searchRoot);
	expect(cwrcLookup.getEntityRoot()).toBe(entityRoot);
});

test('project lookup', async () => {
	expect.assertions(1);

	const projects = await cwrcLookup.setProjectLookupConfig({
		projectLookupUrl,
		projectLogoRoot,
		cwrcProjectId,
	});

	const projectKeys = [];
	for (let key in projects) {
		projectKeys.push(key);
	}

	expect(doObjectsHaveSameKeys(projects, {
        cwrc: '',
        reed: '',
        orlando: '',
    })).toBe(true);
});

test('findPerson', async () => {
	expect.assertions(12);

	const results = await cwrcLookup.findPerson(queryString);

	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBeLessThanOrEqual(expectedResultLength);

	results.forEach((singleResult) => {
        expect(doObjectsHaveSameKeys(singleResult, {
            id: '',
            uri: '',
            uriForDisplay: '',
            name: '',
            nameType: '',
            repository: '',
            originalQueryString: '',
            logo: '',
		})).toBe(true);
		expect(singleResult.originalQueryString).toBe(queryString);
	});
});

test('findPerson - no results', async () => {
	// with no results
	expect.assertions(2);

    const results = await cwrcLookup.findPerson(queryStringWithNoResults);
	expect(Array.isArray(results)).toBe(true);
	expect(results.length).toBe(0);
});

test('findPerson - server error', async () => {
	// with a server error
	expect.assertions(2);

	let shouldBeNullResult = false;
	shouldBeNullResult = await cwrcLookup
		.findPerson(queryStringForError)
		.catch(() => {
			// an http error should reject the promise
			expect(true).toBe(true);
			return false;
		});
	// a falsey result should be returned
	expect(shouldBeNullResult).toBeFalsy();
});

test('findPerson - times out', async () => {
	// when query times out
	expect.assertions(1);
	await cwrcLookup.findPerson(queryStringForTimeout).catch(() => {
		expect(true).toBe(true);
	});
});
