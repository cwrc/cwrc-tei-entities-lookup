let entityRoot = '';
const setEntityRoot = (url) => (entityRoot = url);
const getEntityRoot = () => entityRoot;

let searchRoot = '';
const setSearchRoot = (url) => (searchRoot = url);
const getSearchRoot = () => searchRoot;

let projectLogoRoot = '';
let cwrcProjectId = '';

const findPerson = (queryString) => (
	callCWRC(getPersonLookupURI(queryString), queryString, 'person')
)
const findPlace = (queryString) => callCWRC(getPlaceLookupURI(queryString), queryString, 'place');
const findOrganization = (queryString) => (
	callCWRC(getOrganizationLookupURI(queryString), queryString, 'organization')
)
const findTitle = (queryString) => callCWRC(getTitleLookupURI(queryString), queryString, 'title');

const getPersonLookupURI = (queryString) => getEntitySourceURI(queryString, 'person');
const getPlaceLookupURI = (queryString) => getEntitySourceURI(queryString, 'place');
const getOrganizationLookupURI = (queryString) => getEntitySourceURI(queryString, 'organization');
const getTitleLookupURI = (queryString) => getEntitySourceURI(queryString, 'title');

// note that this method is exposed on the npm module to simplify testing,
// i.e., to allow intercepting the HTTP call during testing, using sinon or similar.
const getEntitySourceURI = (queryString, methodName) => {
	return `${searchRoot}/search/${methodName}?query=${encodeURIComponent(
		queryString
	)}&limit=100&page=0`;
};

const callCWRC = async (url, queryString, nameType) => {
	const response = await fetchWithTimeout(url, { credentials: 'same-origin' }).catch((error) => {
		return error;
	});

	//if status not ok, through an error
	if (!response.ok) {
		throw new Error(
			`Something wrong with the call to CWRC, possibly a problem with the network or the server. HTTP error: ${response.status}`
		);
	}

	const responseJson = await response.json();

	if (!responseJson.response.objects) return [];

	const result = responseJson.response.objects.map((record) => {
		const id = record.PID;
		const name = record.object_label;
		const uri = `${entityRoot}/${id}`;

		const data = {
			id,
			uri,
			uriForDisplay: uri,
			name,
			nameType,
			repository: 'CWRC',
			originalQueryString: queryString,
		};

		const namespace = id.substring(0, id.indexOf(':'));
		const logo = projects[namespace];
		if (logo !== undefined) data.logo = `${projectLogoRoot}/${logo}`;

		return data;
	});

	return result;
};

/**
 * Set all the properties necessary for the project lookup, then perform the lookup
 * @param {Object} config
 * @param {String} projectLogoRoot The root directory that project logos are located in
 * @param {String} projectLookupUrl The actual url for the lookup
 * @param {String} cwrcProjectId The ID assigned to the CWRC Commons project
 * @returns {Object} The projects (namespace and logo)
 */
const setProjectLookupConfig = (config) => {
	projectLogoRoot = config.projectLogoRoot;
	cwrcProjectId = config.cwrcProjectId;
	return doProjectLookup(config.projectLookupUrl);
};

let projects = {};
const doProjectLookup = async (url) => {
	const response = await fetchWithTimeout(url, { credentials: 'same-origin' }).catch((error) => {
		return error;
	});

	if (!response.ok) {
		throw new Error(
			`Something wrong with the call to CWRC, possibly a problem with the network or the server. HTTP error: ${response.status}`
		);
	}

	const responseJson = await response.json();
	projects = parseProjectsData(responseJson);
	return projects;
};

const parseProjectsData = (data) => {
	const parsedProjects = {};
	for (let projectKey in data) {
		const project = data[projectKey];

		let logoFilename = undefined;
		const fieldLogo = project.field_logo;
		if (fieldLogo !== undefined) {
			for (let key in fieldLogo) {
				const entry = fieldLogo[key];
				if (entry.length > 0) {
					logoFilename = entry[0].filename;
				}
			}
		}

		let projectId = undefined;
		const fieldTopLevel = project.field_top_level_collection;
		if (fieldTopLevel !== undefined && fieldTopLevel.und !== undefined) {
			const und = fieldTopLevel.und;
			if (und.length > 0 && und[0].pid !== undefined) {
				const pid = und[0].pid;
				let namespace;
				if (pid === cwrcProjectId) {
					namespace = 'cwrc';
				} else {
					namespace = pid.substring(0, pid.indexOf(':'));
				}
				if (namespace !== '') {
					projectId = namespace;
				}
			}
		}

		if (logoFilename !== undefined && projectId !== undefined) {
			if (parsedProjects[projectId] === undefined) {
				parsedProjects[projectId] = logoFilename;
			}
		}
	}
	return parsedProjects;
};

/*
     config is passed through to fetch, so could include things like:
     {
         method: 'get',
         credentials: 'same-origin'
    }
*/
const fetchWithTimeout = (url, config = {}, time = 30000) => {
	/*
        the reject on the promise in the timeout callback won't have any effect, *unless*
        the timeout is triggered before the fetch resolves, in which case the setTimeout rejects
        the whole outer Promise, and the promise from the fetch is dropped entirely.
    */

	// Create a promise that rejects in <time> milliseconds
	const timeout = new Promise((resolve, reject) => {
		let id = setTimeout(() => {
			clearTimeout(id);
			reject('Call to CWRC timed out');
		}, time);
	});

	// Returns a race between our timeout and the passed in promise
	return Promise.race([fetch(url, config), timeout]);
};

export default {
	setEntityRoot,
	getEntityRoot,
	setSearchRoot,
	getSearchRoot,
	setProjectLookupConfig,
	findPerson,
	findPlace,
	findOrganization,
	findTitle,
	getPersonLookupURI,
	getPlaceLookupURI,
	getOrganizationLookupURI,
	getTitleLookupURI,
	fetchWithTimeout,
};
