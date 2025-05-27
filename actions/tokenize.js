import llama3Tokenizer from 'llama3-tokenizer-js';

const tokenize = {
  handler: async function(req, res) {
    const content = req.body?.content;
    if (!content || typeof content != 'string') return res.status(400).send('Invalid content.');

    try {
      let tokens = tokenize._tokenize(content);
      return res.status(200).json({ tokens: tokens, count: tokens.length });
    } catch(err) {
      return res.status(500).send(err.message);
    }
  },

  // Internal function to split a string into tokens.
  _tokenize: function(content) {
    return llama3Tokenizer.encode(content);
  },
}

export default tokenize;