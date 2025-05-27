# Combined AI Utility Server
This is an all-in-one server to host AI features/models necessary to accelerate prototyping. Each section of this server has many production-ready equivalents that should be used when deploying.

- This runs without GPU dependencies, albeit slowly. 
- Everything is stored and run locally, with no remote dependencies or reporting. 
- There is no security on this server, as it is not meant to support any production applications.
- We don't care about the presentation layer here, we're just providing a local API for all of the utilities and endpoints you will need as you build.

## ⛏️ Data Extraction - Anything -> Markdown

Given a file, return a markdown string of text extracted from the file. In some cases, a description of the content may be returned instead.
- Images: Perform OCR to retrieve any text in the document. Try to use an image-to-text model to describe the image as well.
- Text data, such as a webpage, docx, or pdf:  transform the text into markdown.
- Unsupported files, such as proprietary filetypes should return an error.

#### POST /extract
Send a file to this endpoint and it will attempt to extract some information about it, and return that information as markdown.
`curl --request POST --url http://localhost:3001/extract --header 'Content-Type: multipart/form-data' --form 'file=@C:\Temp\example.docx'`
```js
MultipartFormData: { "file": File }
```
```js
Response: { "content": "# Title\n\nEither the content of your file, or a description of it." }
```

## 📊 Embeddings - Xenova/gte-base ONNX Model

Rather than perform expensive string comparisons on an entire database of text, we transform each entry into a standard multidimensional vector. This is performed by an embedding model. It's important that we use the same embedding model for everything. Both to embed entries for storage, as well as embed queries for lookups.

Embedding models can only handle so many tokens, so we may need to provide a way to split data up in ways that leave each part of the data coherent. Usually, we could split by sentence, or in the case of markdown, we could split on headings and newlines.

#### POST /embed/chunk
If we want to work with a really long string, we will need to split the string into concise sections known as chunks. We should split the string into chunks that will fit within the limitations of our embedding model or our LLM, depending on the use case.

Chunks should be measured in tokens, or as a fallback, characters.

> For embeddings, chunking should be done internally. The end user shouldn't need to manually split strings.

```js
Request: { "content": "This is a long string. It will be split up into chunks based on sentence structure.", "chunkSize": 60 }
```
```js
Response: { "chunks": [ "This is a long string.", "It will be split up into chunks based on sentence structure." ] }
```

#### POST /embed/tokenize
Language models don't measure input by character count. Instead, they use a token count. There isn't a straightforward way to count the tokens in an arbitrary string, so it's beneficial to keep a tokenizer on hand. Tokenize your own content, and use the resulting token count to limit usage or chunk content.

For flexibility, we should return an array of tokens. If we only end up needing the count, we can take the length of the array.
```js
Request: { "content": "This is a long asdf string." }
```
```js
Response: { "tokens": [ "This", "is", "a", "long", "as", "d", "f", "str", "ing", "." ] }
```



#### POST /embed
Given a string, use an embedding model to generate vectors. Since content might be split into multiple chunks, this endpoint will always return an array of chunk-embedding pairs.
```js
Request: { "content": "This string will be transformed into a vector." }
```
```js
Response: { 
  "results": [
      { "content": "This string will be transformed into a vector.", "embedding": [0.1232412, 0.5432342, 0.234523452, ... ] }
    ] 
  }
```
Or, a more complex example:
```js
Request: { "content": [ "Imagine this string is way way way way ... way way wayyy too long.", "This string is fine." ] }
```
```js
Response: { 
  "results": [ 
    { "content": "Imagine this string is way way way way ...", "embedding": [0.1232412, 0.5432342, 0.234523452, ... ] }, 
    // The long string was split into two chunks, which are consecutive in the results.
    {  "content": "... way way wayyy too long.", "embedding": [0.1232412, 0.5432342, 0.234523452, ... ] }, 
    // This content doesn't necessarily have the same index that it did in the request!
    {  "content": "This string is fine.", "embedding": [0.1232412, 0.5432342, 0.234523452, ... ] } 
  ] 
}
```

## 🗃️ Vector Storage/Lookup - SQLite + SQLite-Vec
Now that we have an embedding, we can store it, along with whatever other information is relevant. This gives us a mechanism for long term text data storage. Treat this like a fact/memory store. As your application interacts with your users, pull relevant snippets from storage to inform and reinforce the LLM.

Since we're only interested in storing data for vectors here, we simplify things into collections. Each collection should represent a different corpus or use case, such as "webpages" or "internalKnowledge".

#### GET /db/collection
Returns a list of existing collections, which can accept new vectors.

```js
Response: [ 'collectionA', 'myCollection', 'knowledge', 'tone', 'examples', 'javascript' ]
```

#### POST /db/collection/new
Create a new collection by specifying a title.

```js
Request: {
  "title": "myCollection"
}
```

#### POST /db/:collection/create
Store some content in a collection. Under the hood, a vector database is still a database. We just have another way to query it. Storing a value looks a lot like storing a value in any other database, just with a special vector column.
```js
Request: { 
  "source": "https://neatapp.dev",
  "content": "This string will chunked, embedded, and stored into the specified collection in multiple entries.",
  "collection": "myCollection" // This is optional, as collection will also be specified in the path.
}
```
#### POST /db/:collection/search
Perform a vector search to get relevant content from your collection.
```js
Request: { 
  "query": "This string will be embedded and then used to search the 'vector' column.", 
  "k": 3, // Maximum records to return
}
```
```js
Response: [ 
  { 
    "id": "6510ff60-a7cf-4766-8c3c-66a395b327b3", 
    "content": "whatever"
  }, // This array will contain up to n values.
]
```
#### POST /db/:collection/query TODO
TODO Perform a regular SQL query against your collection. For instance, you may want to get every chunk from a source.
```js
Request: { "query": "SELECT * FROM collection WHERE source = 'https://neatapp.dev' SORT BY chunkIndex ASC;" }
```
```js
Response: [ 
  { 
    "id": "6510ff60-a7cf-4766-8c3c-66a395b327b3", 
    "content": "whatever"
  }
]
```
## 💬 LLM Endpoints
Provide the ability to simply instruct a model and get a direct response, as well as the ability to provide an array of chat history, and get a new message in response.

Internally, we mount a GGUF model using llama.cpp and wrap around that.
#### Installing a GGUF
1. Download a quantized .gguf model from huggingface or llama and place it in the `./models` directory. This was tested with `Mistral-Small-3.1-24B-Base-2503.i1-IQ3_M.gguf` from huggingface.
1. Modify `modelFilename` in `./actions/llm.js` to match your model's filename (without /models).

TODO Look for available models in the models directory. Let the user select one if there is more than one.

#### POST /llm/chat

Submit your chat history and the server will complete the next assistant response.

```js
Request: {
  "context": [
    { "role": "system", content: "Respond as if you were texting a friend" },
    { "role": "user", content: "Hello, how are you?" }
  ]
}
```
```js
Response: {
  "response": "Hello! I am doing well, thank you for asking. How are you?"
}
```