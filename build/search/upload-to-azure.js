import { promises as fs } from 'fs';

const {
  SearchIndexClient,
  AzureKeyCredential,
} = require('@azure/search-documents');

require('dotenv').config();

const searchServiceName = process.env.AZ_SEARCH_SERVICE_NAME || '';
const adminApiKey = process.env.AZ_SEARCH_ADMIN_KEY || '';

async function main() {
  const siteConfig = JSON.parse(
    await fs.readFile(`./build/site-config.json`, 'utf8')
  );

  const search = JSON.parse(
    await fs.readFile(`./${siteConfig.output.main}/js/search.json`, 'utf8')
  );

  if (!searchServiceName || !adminApiKey) {
    console.warn('please configure required env vars');
    return;
  }
  const indexClient = new SearchIndexClient(
    searchServiceName,
    new AzureKeyCredential(adminApiKey)
  );
  const searchClient = indexClient.getSearchClient(`blog-index`);

  console.log('Uploading documents...');
  let indexDocumentsResult = await searchClient.mergeOrUploadDocuments(search);
  console.log(
    `Index operations succeeded: ${JSON.stringify(
      indexDocumentsResult.results[0].succeeded
    )}`
  );
}

main().catch((err) => {
  console.error('Error while re-building Azure Search Index:', err);
});
