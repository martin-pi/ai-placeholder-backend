import tokenize from "./tokenize.js";

const chunk = {
  handler: async function(req, res) {
    const content = req.body?.content;
    if (!content || typeof content != 'string') return res.status(400).send('Invalid content.');
    const chunkSize = req.body?.chunkSize;
    if (!chunkSize || typeof chunkSize != 'number') return res.status(400).send('Invalid chunkSize.');
    const method = req.body?.method ?? 'tokens';
    if (!method || !(['tokens', 'characters'].includes(method))) return res.status(400).send('Invalid method. Must be "tokens" or "characters", or undefined.');
    const detailed = req.body?.detailed ?? false;

    try {
      let chunks = [];
      if (method == 'characters') chunk = chunks._chunkByCharacters(content, chunkSize);
      else chunks = chunk._chunkByTokens(content, chunkSize);

      if (detailed) { // Return some additional details about each chunk.
        var detailedChunks = [];
        for (let i = 0; i < chunks.length; i++) {
          let chunk = chunks[i];
          detailedChunks.push({
            content: chunk,
            tokens: tokenize._tokenize(chunk).length,
            index: i
          });
        }
        return res.status(200).json({ chunks: detailedChunks});
      }

      return res.status(200).json({ chunks: chunks });
    } catch(err) {
      return res.status(500).send(err.message);
    }
  },


  // TODO Chunk using markdown headers, to ensure that a chunk starts with a relevant title.


  // Internal function to perform chunking operations using character count.
  _chunkByCharacters: function(content, chunkSize) {
    var chunks = content.split(/(?=[.!?;\n])|(?<=[.!?;\n])/gm);

    // Get as close to chunkSize as possible without splitting sentences.
    for(let i = 0; i < chunks.length - 1; i++) {
      let current = chunks[i];
      if ((current + chunks[i+1]).length < chunkSize) {
        chunks[i] = (chunks[i] + chunks[i+1]).trim();
        chunks.splice(i+1, 1);
        i--;
      }
    }
  
    // Remove chunks that are too short, too long, or only a single word.
    chunks = chunks.filter((c) => {
      return typeof c == 'string' && c.length > 5 && c.includes(' ') && c.length < chunkSize;
      // TODO If a chunk is too long, just manually split it at chunkSize rather than throw it out?
    });
    return chunks;
  },

  // Internal function to perform chunking operations using token count
  _chunkByTokens: function(content, tokenLimit) {
    var chunks = [];
    if (Array.isArray(content)) {
      chunks = [];
      content.forEach((str) => {
        chunks.push(str.split(/(?=[.!?;\n])|(?<=[.!?;\n])/gm));
      });
    } else if (typeof content === 'string') {
      chunks = content.split(/(?=[.!?;\n])|(?<=[.!?;\n])/gm);
    } else {
      console.error(`_chunkByTokens: Content should be a string or array of strings.`);
      return [];
    }

    // Get as close to the token limit as possible without splitting sentences.
    for(let i = 0; i < chunks.length - 1; i++) {
      let current = chunks[i];
      let currentTokens = tokenize._tokenize(current).length;
      let next = chunks[i+1];
      let nextTokens = tokenize._tokenize(next).length;
      if (currentTokens + nextTokens < tokenLimit) {
        chunks[i] = (current + next).trim();
        chunks.splice(i+1, 1);
        i--;
      }
    }
  
    // Remove chunks that are too short, too long, or only a single word.
    chunks = chunks.filter((c) => {
      let chunkTokens = tokenize._tokenize(c).length;
      return typeof c == 'string' && chunkTokens > 1 && chunkTokens < tokenLimit;
      // TODO If a chunk is too long, just manually split it at chunkSize rather than throw it out?
    });

    return chunks;
  },
}

export default chunk;