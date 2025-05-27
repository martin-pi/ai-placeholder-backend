import chunk from "./chunk.js";

import { pipeline } from "@xenova/transformers";

const embed = {
  embedder: null,
  maxChunk: 512,

  // Web handler/wrapper for the _embed function.
  handler: async function(req, res) {
    const content = req.body?.content;
    if (!content || typeof content != 'string') return res.status(400).send('Invalid content.');
    const vector = await embed._embed(content);
    return res.status(200).json({ embeddings: vector });
  },

  // Generically embed content. If content is too large for the token limit, automatically chunk it.
  // Also accepts an array of strings as input, pre-chunked or not. Chunks each individual string if necessary.
  // Always returns an array of content/vector pairs, even if content does not need to be chunked.
  _embed: async function(content) {
    if (!embed.embedder) await embed.initialize();

    var results = [];
    if (Array.isArray(content)) {
      for (let i = 0; i < content.length; i++) {
        var chunks = chunk._chunk(content[i], embed.maxChunk);
        for (let j = 0; j < chunks.length; j++) {
          const embedding = embed._embedOne(chunks[j])
          results.push({
            content: chunks[j],
            embedding: embedding
          });
        }
      }
    } else {
      var chunks = chunk._chunkByTokens(content, embed.maxChunk);
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embed._embedOne(chunks[i]);
        results.push({
          content: chunks[i],
          embedding: embedding
        });
      }
    }

    return results;
  },

  // Only use if content is guaranteed to fit within the token limit. embed the content.
  // Return a vector embedding.
  _embedOne: async function(content) {
    if (typeof content != 'string') throw new Error(`Improper content type: ${ typeof content }`);
    content = content.substring(0, embed.maxChunk);
    const embedding = (await embed.embedder(content, {
      pooling: 'mean',
      normalize: true
    })).tolist();
    return embedding[0];
  },

  initialize: async function() {
    const model = "Xenova/gte-small";
    const modelTokenLimit = 512;
    
    console.log(`Initializing Embedding Model "${model}"...`);
    embed.embedder = await pipeline("feature-extraction", model);
    console.log("\tLoaded Model.");

    embed.maxChunk = Math.floor(modelTokenLimit);
    console.log(`\tSetting embedding token limit to ${embed.maxChunk}.`);
  }

}

export default embed;