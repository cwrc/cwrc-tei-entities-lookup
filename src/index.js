'use strict';

let entityRoot = ''
function setEntityRoot(url) {
    entityRoot = url
}
function getEntityRoot() {
    return entityRoot
}

let searchRoot = ''
function setSearchRoot(url) {
    searchRoot = url
}
function getSearchRoot() {
    return searchRoot
}

let projectLogoRoot = ''
function setProjectLogoRoot(url) {
    projectLogoRoot = url
}
function getProjectLogoRoot() {
    return projectLogoRoot
}

let projectUrl = ''
async function setProjectLookupURI(url) {
    projectUrl = url
    return doProjectLookup()
}

let projects = {}
async function doProjectLookup() {
    return fetch(projectUrl, {
        method: 'get',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    }).then(async (response) => {
        const data = await response.json()
        for (let projectKey in data) {
            const project = data[projectKey]
            
            let logoFilename = undefined
            const fieldLogo = project.field_logo
            if (fieldLogo !== undefined) {
                for (let key in fieldLogo) {
                    const entry = fieldLogo[key]
                    if (entry.length > 0) {
                        logoFilename = entry[0].filename
                    }
                }
            }
            
            let projectId = undefined
            const fieldTopLevel = project.field_top_level_collection
            if (fieldTopLevel !== undefined && fieldTopLevel.und !== undefined) {
                const und = fieldTopLevel.und
                if (und.length > 0 && und[0].pid !== undefined) {
                    const pid = und[0].pid
                    const namespace = pid.substring(0, pid.indexOf(':'))
                    if (namespace !== '') {
                        projectId = namespace
                    }
                }
            }
            
            if (logoFilename !== undefined && projectId !== undefined) {
                if (projectId === 'islandora') {
                    projectId = 'cwrc'
                }
                if (projects[projectId] === undefined) {
                    projects[projectId] = logoFilename
                }
            }
        }
        return projects;
    }, (reason) => {
        console.warn('project lookup failed', reason)
    })
}

/*
     config is passed through to fetch, so could include things like:
     {
         method: 'get',
         credentials: 'same-origin'
    }
*/
function fetchWithTimeout(url, config = {}, timeout = 8000) {

        return new Promise((resolve, reject) => {
            // the reject on the promise in the timeout callback won't have any effect, *unless*
            // the timeout is triggered before the fetch resolves, in which case the setTimeout rejects
            // the whole outer Promise, and the promise from the fetch is dropped entirely.
            setTimeout(() => reject(new Error('Call to CWRC timed out')), timeout);
            fetch(url, config).then(resolve, reject);
        }).then(
            response=>{
                // check for ok status
                if (response.ok) {
                    return response.json()
                }
                // if status not ok, through an error
                throw new Error(`Something wrong with the call to CWRC, possibly a problem with the network or the server. HTTP error: ${response.status}`);
            }/*,
            // instead of handling and rethrowing the error here, we just let it bubble through
            error => {
            // we could instead handle a reject from either of the fetch or setTimeout promises,
            // whichever first rejects, do some loggingor something, and then throw a new rejection.
                console.log(error)
                return Promise.reject(new Error(`some error jjk: ${error}`))
            }*/
        )
}

// note that this method is exposed on the npm module to simplify testing,
// i.e., to allow intercepting the HTTP call during testing, using sinon or similar.
function getEntitySourceURI(queryString, methodName) {
    return `${searchRoot}/search/${methodName}?query=${encodeURIComponent(queryString)}&limit=100&page=0`;
}

function getPersonLookupURI(queryString) {
    return getEntitySourceURI(queryString, 'person')
}

function getPlaceLookupURI(queryString) {
    return getEntitySourceURI(queryString, 'place')
}

function getOrganizationLookupURI(queryString) {
    return getEntitySourceURI(queryString, 'organization')
}

function getTitleLookupURI(queryString) {
    return getEntitySourceURI(queryString, 'title')
}

function callCWRC(url, queryString, nameType) {

        return fetchWithTimeout(url, {credentials: 'same-origin'}).then((parsedJSON)=>{
            console.log(parsedJSON)
            return parsedJSON.response.objects ? parsedJSON.response.objects.map(
                (record) => {
                    let id = record.PID
                    let name = record.object_label
                    let uri = entityRoot + '/'+ id
                    
                    let data = {id, uri, uriForDisplay: uri, name, nameType, repository: 'CWRC', originalQueryString: queryString}
                    
                    let namespace = id.substring(0, id.indexOf(':'))
                    let logo = projects[namespace]
                    if (logo !== undefined) {
                        data.logo = projectLogoRoot + '/' + logo
                    }
                    
                    return data
                }) : []
        })

}

function findPerson(queryString) {
    return callCWRC(getPersonLookupURI(queryString), queryString, 'person')
}

function findPlace(queryString) {
    return callCWRC(getPlaceLookupURI(queryString), queryString, 'place')
}

function findOrganization(queryString) {
    return callCWRC(getOrganizationLookupURI(queryString), queryString, 'organization')
}

function findTitle(queryString) {
    return callCWRC(getTitleLookupURI(queryString), queryString, 'title')
}

module.exports = {
    setEntityRoot: setEntityRoot,
    getEntityRoot: getEntityRoot,
    setSearchRoot: setSearchRoot,
    getSearchRoot: getSearchRoot,
    
    getProjectLogoRoot: getProjectLogoRoot,
    setProjectLogoRoot: setProjectLogoRoot,
    setProjectLookupURI: setProjectLookupURI,
    
    findPerson: findPerson,
    findPlace: findPlace,
    findOrganization: findOrganization,
    findTitle: findTitle,
    getPersonLookupURI: getPersonLookupURI,
    getPlaceLookupURI: getPlaceLookupURI,
    getOrganizationLookupURI: getOrganizationLookupURI,
    getTitleLookupURI: getTitleLookupURI,
    fetchWithTimeout: fetchWithTimeout
}