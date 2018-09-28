'use strict';

const searchRoot = 'https://beta.cwrc.ca/';
const entityRoot = 'https://commons.cwrc.ca/';
const projectLogoRoot = 'https://beta.cwrc.ca/sites/default/files';

let cwrcLookup = require('../src/index.js');
cwrcLookup.setSearchRoot(searchRoot);
cwrcLookup.setEntityRoot(entityRoot);

const path = require('path')
const tape = require('tape');
var _test = require('tape-promise').default;
const test = _test(tape) // decorate tape to allow promises
const sinon = require('sinon')
const fetchMock = require('fetch-mock');

const queryString = 'john';
const queryStringWithNoResults = 'ldfjk';
const queryStringForTimeout = "chartrand";
const queryStringForError = "cuff";
const expectedResultLength = 10;
const emptyResultFixture = JSON.stringify(require('./httpResponseMocks/noResults.json'));
const resultsFixture = JSON.stringify(require('./httpResponseMocks/results.json'));

const projectUrl = 'foobar';
const projectResultsFixture = JSON.stringify(require('./httpResponseMocks/projectResults.json'));

var clock;

// setup server mocks

let uriBuilderFn = cwrcLookup.getPersonLookupURI;

fetchMock.get(uriBuilderFn(queryString), resultsFixture);
fetchMock.get(uriBuilderFn(queryStringWithNoResults), emptyResultFixture);
fetchMock.get(uriBuilderFn(queryStringForTimeout), (url, opts)=> {
    // This function that we are in is called by fetchMock, instead of calling fetch itself.
    // We use sinon to advance time without having to actually wait the 8 seconds.
    clock.tick(8100);
    // at this point in time, i.e. after 8 seconds have passed, the wrapper we have around our fetch call should have timed out,
    // and returned a rejected promise.
    clock.restore();
    // return the promise that fetchMock is expecting, to avoid errors
    Promise.resolve()
});
fetchMock.get(uriBuilderFn(queryStringForError), 500);

fetchMock.get(projectUrl, projectResultsFixture);


// babel-plugin-istanbul adds instrumentation to the browserified/babelified bundle, during babelification.
// When the tests are run on the browserified/babelified bundle, the instrumentation records test coverage and puts it in
// the global scope (which in the browser is 'window'.)  So when the tests finish, we get the test coverage output
// from window.__coverage__ , prepend '# coverage', and then append all of it to the TAPE console output (which also has the tape test results).
// We prepend '# coverage' to the coverage information, so we can easily find it later
// when we extract the coverage in the node test/extract-coverage.js command, used in the test scripts in package.json
test.onFinish(()=>{
    console.log('# coverage:', JSON.stringify(window.__coverage__))
    window.close()
});

// from https://stackoverflow.com/a/35047888
function doObjectsHaveSameKeys(...objects){
    const allKeys = objects.reduce((keys, object) => keys.concat(Object.keys(object)), []);
    const union = new Set(allKeys);
    return objects.every(object => union.size === Object.keys(object).length);
}

test('lookup builder', (assert)=> {
    assert.plan(1);
    assert.comment('getPersonLookupURI');
    assert.ok(cwrcLookup.getPersonLookupURI(queryString).includes(queryString), 'should contain the query string');
});

test('get/set roots', (assert)=> {
    assert.plan(2);
    assert.equal(cwrcLookup.getSearchRoot(), searchRoot, 'searchRoot should be the same');
    assert.equal(cwrcLookup.getEntityRoot(), entityRoot, 'entityRoot should be the same');
});

test('project logo root', async (assert) => {
    assert.plan(1);
    cwrcLookup.setProjectLogoRoot(projectLogoRoot)
    assert.equal(cwrcLookup.getProjectLogoRoot(), projectLogoRoot, 'project logo root should be the same')
});

test('project lookup', async (assert) => {
    assert.plan(1);
    let projects = await cwrcLookup.setProjectLookupURI(projectUrl, assert)
    let projectKeys = []
    for (let key in projects) {
        projectKeys.push(key)
    }
    assert.ok(doObjectsHaveSameKeys(projects, {
        cwrc: '',
        reed: '',
        orlando: ''
    }), 'projects have been set')
});

test('findPerson', async function(assert){
    let thisAssert = assert
   // thisAssert.plan(21);
    let lookupFn = cwrcLookup.findPerson;
    thisAssert.equal(typeof lookupFn, 'function', 'is a function');
    let results = await lookupFn(queryString);
    thisAssert.ok(Array.isArray(results), 'should return an array of results');
    thisAssert.ok(results.length <= expectedResultLength, `should return fewer than or equal to ${expectedResultLength} results`);
    results.forEach(singleResult => {
        thisAssert.ok(doObjectsHaveSameKeys(singleResult, {
            id: '',
            uri: '',
            uriForDisplay: '',
            name: '',
            nameType: '',
            repository: '',
            originalQueryString: '',
            logo: ''
        }), 'all results have correct keys')
        thisAssert.equal(singleResult.originalQueryString, queryString, 'each result should return the original query string')
    })

    thisAssert.comment('with no results');
    results = await lookupFn(queryStringWithNoResults);
    thisAssert.ok(Array.isArray(results), 'should return an array');
    thisAssert.equal(results.length, 0, `should return an empty array`)

    thisAssert.comment('with a server error');
    let shouldBeNullResult = false;
    shouldBeNullResult = await lookupFn(queryStringForError).catch(error=>{
         thisAssert.true(true, 'an http error should reject the promise');
         return false;
    })
    thisAssert.comment('a falsey result should be returned')
    thisAssert.notOk(shouldBeNullResult, 'should be falsey');

    thisAssert.comment('when query times out');

    // use sinon to override the clock used for setTimeout
    // We manually advance the clock up in the mock
    clock = sinon.useFakeTimers({
        now: Date.now(),
        toFake: ["setTimeout"]
    });
    try {
       await lookupFn(queryStringForTimeout);
    } catch (err) {
        thisAssert.ok(true, 'the promise should be rejected')
    }
    thisAssert.end()
})





