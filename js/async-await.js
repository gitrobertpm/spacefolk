const astrosUrl = 'http://api.open-notify.org/astros.json';
const wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const wikiRelated = 'https://en.wikipedia.org/api/rest_v1/page/related/'
const peopleList = document.getElementById('people');
const btn = document.querySelector('button');

// Handle all fetch requests
async function getJSON(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function getPeopleInSpace(url) {

  // Get people in space
  const peopleJSON = await getJSON(url);

  // Get Wiki pages for people in space
  let profiles = await Promise.all(peopleJSON.people.map( async (person) => {
    const craft = person.craft;
    const profileJSON = await getJSON(wikiUrl + person.name);  
    return { ...profileJSON, craft };
  }));

  // Return disambiguation pages from Wiki results
  const disambiguationResults = profiles.filter(prof => prof.type === 'disambiguation');

  // Check if there are disambiguation pages in the Wiki results
  if (disambiguationResults.length) {

    // Return non disambiguation pages from original request
    const standardResults = profiles.filter(prof => prof.type === 'standard');

    // Make a new request to get list of pages related to query value that resulted in disambiguation pages
    const relatedPages = await Promise.all(disambiguationResults.map( async result => await getJSON(wikiRelated + result.title + '?pages=50')));

    // Helper function for checking if string contains certain space related terms
    const spacey = str => str.includes('astronaut') || str.includes('NASA') || str.includes('space') || str.includes('cosmonaut');

    // Loop over collection of related pages results 
    const newStandardPages = relatedPages.map((pages, indy) => {
      const p = pages.pages;

      // Loop over related pages and return the first one with a "standard" type and a description that contains a "space" term
      for (let i = 0, j = p.length; i < j; i++) {
        if (p[i].type === 'standard' && p[i].description && spacey(p[i].description)) return p[i];
      }

      // If the above loop doesn't return a result page, 
      // return a new object containing the name and a "More results" wiki link for the missing individual
      const disambiguationNames = disambiguationResults.map(prof => prof.title);
      const disambiguationLinks = disambiguationResults.map(prof => prof.content_urls.desktop.page);
      return {noResult: true, name: disambiguationNames[indy], link: disambiguationLinks[indy]};
    });

    // Flatten original "standard" results concatenated with new "unambiguated" results
    profiles = [...standardResults, ...newStandardPages]
  }

  // Return space-folk
  return profiles;
}

// Generate the markup for each profile
function generateHTML(data) {
  data.map( person => {
    const section = document.createElement('section');
    peopleList.appendChild(section);

    // Template literal HTML string for results
    // Ternary conditional to show results as well alternative HTML when there are no results for one or more of the folks in space
    section.innerHTML = person.noResult ? `
      <h2>Results unavailable for ${person.name}</h2>
      <p>For more results, try clicking <a href=${person.link} target="_blank">here</a></p>
    ` : `
      <img src=${person.thumbnail ? person.thumbnail.source : ''}>
      <span>${person.craft ? person.craft : 'ISS'}</span>
      <h2>${person.title.replaceAll('_', ' ')}</h2>
      <p>${person.description}</p>
      <p>${person.extract}</p>
    `;
  });
}

btn.addEventListener('click', (event) => {
  event.target.textContent = 'Loading...';

  getPeopleInSpace(astrosUrl)
    .then(generateHTML)
    .catch( e => {
      peopleList.innerHTML = '<h3>Something went wrong!</h3>';
      console.error(e);
    })
    .finally( () => event.target.remove() )
});