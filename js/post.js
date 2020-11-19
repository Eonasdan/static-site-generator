function showPosts(filteredPosts) {
    let html = '';
    if (!filteredPosts || filteredPosts.length === 0) html = '<h1>No results</h1>';
    filteredPosts.forEach(post => {
        html += `[POSTLOOP]`;
    });
    document.getElementById('post-container').innerHTML = html;
}

const urlParams = new URLSearchParams(window.location.search);
const term = urlParams.get('search');
if (term) {
    document.getElementById('search').value = term;
    fetch('/posts/posts.json')
        .then(response => response.json())
        .then(data => {
            showPosts(data.filter(x => x.title.toLowerCase().includes(term.toLowerCase()) || x.body.toLowerCase().includes(term.toLowerCase())));
        });
}


function onLinkClick(e) {
    window.location.href = e.target.href;
}

[...document.querySelectorAll('.vizew-pager .post-title')].forEach(element => element.addEventListener('click', onLinkClick));