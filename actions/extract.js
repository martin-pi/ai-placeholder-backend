import { getTextExtractor } from 'office-text-extractor';
import TurndownService from 'turndown';

const extract = {

  // Given a file, returns a markdown representation/description of that file.
  handler: async function(req, res) {
    // Start by extracting the file from the request with express-fileupload.
    if (!req.files) return res.status(400).send('No files could be read from request.');
    const file = req.files.file;
    if (!file) return res.status(400).send('Missing file.');
    const content = file.data; // buffer.

    // Pick a methodology based on the mimetype of the file.
    try {
      if (file.mimetype.includes('image')) {
        var result = await extract._ocr(content);
        return res.status(200).json({ content: result });
      } else if (file.mimetype.includes('html')) {
        var result = await extract._html(content);
        return res.status(200).json({ content: result });
      } else {
        var result = await extract._office(content);
        return res.status(200).json({ content: result });
      }
    } catch(err) {
      console.error(err);
      return res.status(500).send('An error occurred.');
    }
    
    // Once extracted, we are no longer interested in the file. Don't save it.
  },

  _html: async function(html) {
    const htmlAsString = html.toString();
    var service = new TurndownService({
      headingStyle: 'atx',
    });
    service.remove('nav');
    service.remove('style');
    service.remove('script');
    service.remove('noscript');
    var markdown = service.turndown(htmlAsString);
    return markdown;
  },

  _office: async function(buffer) {
    const extractor = getTextExtractor();
    const text = await extractor.extractText({ input: buffer, type: 'buffer' });
    return text;
  },

  _ocr: async function(buffer) {
    // OCR? Image->Text Models?
    return 'OCR/TTI Unimplemented.';
  },

  _epub: async function(buffer) {
    return 'epub unimplemented.';
  },
}

export default extract;