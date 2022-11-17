const useAzureSearch = false;
const urlParams = new URLSearchParams(window.location.search);
const term = urlParams.get('search');

class Search {
  showPosts(filteredPosts) {
    let html = '';
    if (!filteredPosts || filteredPosts.length === 0)
      html = '<h1>No results</h1>';
    filteredPosts.forEach((post) => {
      html += `[POSTLOOP]`;
    });
    document.getElementById('post-container').innerHTML = html;
  }

  searchAzureAsync() {
    const formatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return new Promise((resolve, reject) => {
      const azureUrl = '[AZURE_SEARCH]';
      const termPrep = term.replace('tag:', '').replace("'", "\\'");
      let postBody = {};

      if (term.startsWith('tag:')) {
        postBody.filter = `(tags/any(t: t eq '${termPrep}'))`;
      } else {
        postBody.search = termPrep;
      }

      fetch(azureUrl, {
        method: 'post',
        headers: {
          'api-key': '[AZURE_SEARCH_API_KEY]',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
      })
        .then((response) => response.json())
        .then((data) => {
          data.value.forEach(
            (x) => (x.postDate = formatter.format(new Date(x.postDate)))
          );
          resolve(data.value);
        })
        .catch((e) => reject(e));
    });
  }

  searchLocalAsync() {
    return new Promise((resolve, reject) => {
      fetch('/js/search.json')
        .then((response) => response.json())
        .then((data) => {
          resolve(data);
        })
        .catch((e) => reject(e));
    });
  }

  async doAsync(termLower) {
    let data;
    if (useAzureSearch) {
      data = await this.searchAzureAsync(termLower);
    } else {
      data = await this.searchLocalAsync(termLower);
    }
    if (term.startsWith('tag:'))
      this.showPosts(
        data.filter((x) => x.tags.includes(termLower.replace('tag:', '')))
      );
    else
      this.showPosts(
        data.filter(
          (x) =>
            x.title.toLowerCase().includes(termLower) ||
            x.body.includes(termLower)
        )
      );
  }
}

const search = new Search();

if (term) {
  document.getElementById('search').value = term;
  const termLower = term.toLowerCase();
  search.doAsync(termLower).then();
}

// function onLinkClick(e) {
//   window.location.href = e.target.href;
// }
//
// [...document.querySelectorAll('.pager .post-title')].forEach((element) =>
//   element.addEventListener('click', onLinkClick)
// );
