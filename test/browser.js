'use strict';

const searchRoot = 'https://beta.cwrc.ca/';
const entityRoot = 'https://commons.cwrc.ca/';

const projectLogoRoot = 'https://beta.cwrc.ca/sites/default/files';
const projectLookupUrl = 'foobar';
const cwrcProjectId = 'cwrc:cwrc';

let cwrcLookup = require('../src/index.js');
cwrcLookup.setSearchRoot(searchRoot);
cwrcLookup.setEntityRoot(entityRoot);

const fetchMock = require('fetch-mock');

const queryString = 'john';
const queryStringWithNoResults = 'ldfjk';
const queryStringForTimeout = "chartrand";
const queryStringForError = "cuff";
const expectedResultLength = 10;
const emptyResultFixture = JSON.stringify(require('./httpResponseMocks/noResults.json'));
const resultsFixture = JSON.stringify(require('./httpResponseMocks/results.json'));

const projectResultsFixture = JSON.stringify(require('./httpResponseMocks/projectResults.json'));

jest.useFakeTimers();

// setup server mocks

let uriBuilderFn = cwrcLookup.getPersonLookupURI;

fetchMock.get(uriBuilderFn(queryString), resultsFixture);
fetchMock.get(uriBuilderFn(queryStringWithNoResults), emptyResultFixture);
fetchMock.get(uriBuilderFn(queryStringForTimeout), (url, opts)=> {
    setTimeout(Promise.resolve, 8100);
});
fetchMock.get(uriBuilderFn(queryStringForError), 500);

fetchMock.get(projectLookupUrl, projectResultsFixture);

// from https://stackoverflow.com/a/35047888
function doObjectsHaveSameKeys(...objects){
    const allKeys = objects.reduce((keys, object) => keys.concat(Object.keys(object)), []);
    const union = new Set(allKeys);
    return objects.every(object => union.size === Object.keys(object).length);
}

test('lookup builder', ()=> {
    expect.assertions(1);
    expect(cwrcLookup.getPersonLookupURI(queryString).includes(queryString)).toBe(true);
});

test('get/set roots', ()=> {
    expect.assertions(2);
    expect(cwrcLookup.getSearchRoot()).toBe(searchRoot);
    expect(cwrcLookup.getEntityRoot()).toBe(entityRoot);
});

test('project lookup', async () => {
    expect.assertions(1);
    let projects = await cwrcLookup.setProjectLookupConfig({
        projectLookupUrl,
        projectLogoRoot,
        cwrcProjectId
    })
    let projectKeys = []
    for (let key in projects) {
        projectKeys.push(key)
    }
    expect(doObjectsHaveSameKeys(projects, {
        cwrc: '',
        reed: '',
        orlando: ''
    })).toBe(true);
});

test('findPerson', async () => {
    expect.assertions(18);
    let lookupFn = cwrcLookup.findPerson;
    expect(typeof lookupFn).toBe('function');
    let results = await lookupFn(queryString);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(expectedResultLength);
    results.forEach(singleResult => {
        expect(doObjectsHaveSameKeys(singleResult, {
            id: '',
            uri: '',
            uriForDisplay: '',
            name: '',
            nameType: '',
            repository: '',
            originalQueryString: '',
            logo: ''
        })).toBe(true);
        expect(singleResult.originalQueryString).toBe(queryString);
    })

    // with no results
    results = await lookupFn(queryStringWithNoResults);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);

    // with a server error
    let shouldBeNullResult = false;
    shouldBeNullResult = await lookupFn(queryStringForError).catch(error=>{
            // an http error should reject the promise
            expect(true).toBe(true);
            return false;
    })

    // a falsey result should be returned
    expect(shouldBeNullResult).toBeFalsy();

    // when query times out
    try {
       await lookupFn(queryStringForTimeout);
    } catch (err) {
        // the promise should be rejected
        expect(true).toBe(true);
    }
})
