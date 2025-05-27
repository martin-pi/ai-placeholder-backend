import { getLlama, LlamaChatSession } from "node-llama-cpp";

const modelFilename = "Mistral-Small-3.1-24B-Base-2503.i1-IQ3_M.gguf";

const llm = {
  llama: null,
  model: null,

  // Web handler/wrapper for the _embed function.
  handler: async function(req, res) {
    const context = req.body?.context;
    if (!context || !Array.isArray(context)) return res.status(400).send('Invalid prompt. Expected an array of objects, such as [{"role": "system", "content": "You are a robot." }]');
    context.forEach((message, i) => {
      if (!(['system', 'assistant', 'user'].includes(message.role))) return res.status(400).send(`Invalid role at message ${i}: "${message.role}"`);
      if (typeof message.content != 'string' || message.content.length < 1) return res.status(400).send(`Invalid Content at message ${i}.`);
    });

    // Transform the prompt into Zephyr template format.
    var fullPrompt = "";
    context.forEach((message) => {
      fullPrompt += `<|${message.role}|>\n${message.content}</s>\n`;
    });
    fullPrompt += '<|assistant|>\n';

    // Pass the formatted prompt to the LLM.
    const response = await llm._prompt(fullPrompt);
    return res.status(200).json({ response: response });
  },

  // Use the model to respond directly to a prompt.
  _prompt: async function(prompt) {
    if (!llm.model) return 'No Model is loaded.';
    const instantContext = await llm.model.createContext();
    const instantSession = new LlamaChatSession({ contextSequence: instantContext.getSequence() });
    const result = await instantSession.prompt(prompt);
    
    instantSession.dispose();
    instantContext.dispose();
    return result;
  },

  initialize: async function() {
    
    

    // TODO look in ./models for .gguf files.
    fileNames = [];
    if (filenames.length < 1) {
      console.error(`No .gguf models were found in ./models. LLM functionality will not be enabled.`);
      return;
    } else if (filenames.length == 1) {
      // TODO There is only one file, use it.
    } else {
      // TODO Let the user pick a file.
    }

    console.log(`Initializing LLM Model "${modelFilename}"...`);
    const options = {
      //gpu: false,
      //logLevel: "debug",
      //logger: (level, message) => { console.log(`${level}: ${message}`); },
      //debug: true,
      vramPadding: (total) => { return Math.min(total / 4); }, // leave at least 25% of vram open. 
      //progressLogs: true,
    };

    llm.llama = await getLlama(options);
    llm.model = await this.llama.loadModel({
      modelPath: `./models/${modelFilename}`
    });
    console.log("\tLoaded Model.");

    // Uncomment to immediately test the model when loading the server.
    /*const testContext = await llm.model.createContext();
    const testSession = new LlamaChatSession({
      contextSequence: testContext.getSequence()
    });
    const testPrompt = "Hello, how are you?";
    console.log(`\tSending Test Prompt: "${testPrompt}"`);
    let before = new Date().getTime();
    const testResult = await testSession.prompt(testPrompt);
    let after = Math.floor((new Date().getTime() - before) / 1000);
    console.log(`\tModel Response in ${after}s: "${testResult}"`);
    testSession.dispose();
    testContext.dispose();*/
    
  }

}

export default llm;