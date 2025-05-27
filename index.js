import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';

const port = 3001;

const app = express();
app.use(cors());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
}));
app.use(express.json());

import extract from './actions/extract.js';
app.post('/extract', extract.handler);

import chunk from './actions/chunk.js';
app.post('/embed/chunk', chunk.handler);

import tokenize from './actions/tokenize.js';
app.post('/embed/tokenize', tokenize.handler);

import embed from './actions/embed.js';
app.post('/embed', embed.handler);

import llm from './actions/llm.js';
app.post('/llm/chat', llm.handler);

import db from './actions/db.js';
app.get('/db/collection', db.listCollectionsHandler);
app.post('/db/collection/new', db.createCollectionHandler);

app.post('/db/:collection/create', db.createHandler);
//app.post('/db/:collection/delete', db.deleteHandler);
app.post('/db/:collection/search', db.queryHandler);


//app.post('/db/collection/truncate', db.truncateCollectionHandler);

async function initialize() {
  await embed.initialize();
  await db.initialize();
  await llm.initialize();

  await app.listen(port);
  console.log(`Listening at https://localhost:${port}`);
}

initialize();