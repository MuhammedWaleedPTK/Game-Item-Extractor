import { pipeline } from '@huggingface/transformers';

async function test() {
    console.log("Loading pipeline...");
    const segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'cpu' // Keep it simple for node
    });

    // We can use a tiny random image or an actual file from the directory
    // Let's use the favicon.png
    console.log("Processing image...");
    const result = await segmenter('favicon.png');

    console.log("Result:", JSON.stringify(result, null, 2));
}

test().catch(console.error);
