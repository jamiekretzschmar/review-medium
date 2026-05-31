
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ItemAnalysis, ReviewOutput, StyleMirror, ComparisonItem, ComparisonData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION_IDENTIFICATION = `You are an elite product specialist. Your job is to identify a product from an image or a link. 
Be precise. Provide the name, a short sleek description, and key features. 
CRITICAL RULE FOR BOOKS: If the item appears to be a book (e.g., you see a cover, spine, or text indicating a title and author), you MUST identify the exact book Title and Author. Use Google Search to verify the book title and author if necessary. Do not provide a generic description like "A book with a cover".
Format the response strictly as JSON.`;

const SYSTEM_INSTRUCTION_REVIEW = `You are ghostwriting a product review for a user. The review MUST be written in the FIRST PERSON ("I", "me", "my") as if the user themselves is the one writing it for a community.

You are known for deep empathy and unwavering truthfulness. You are never rude. You understand that people spend hard-earned money on these items.
When the user likes something, express it with genuine warmth. When something is flawed, explain why with kindness but absolute honesty.

CONSTRAINTS:
1. PERSPECTIVE: Always write in the first person ("I"). NEVER refer to "the user" in the review text.
2. ABSOLUTELY PROHIBITED PHRASES: "delve into", "at its core", "it's important to note", "in the ever-evolving landscape", "tapestry", "testament", "embark", "comprehensive guide", "look no further".
3. WRITING STYLE: Use "bursty" writing. Mix short, punchy sentences with longer, descriptive ones. Avoid monotone rhythms.
4. TONE: Be conversational, empathetic, and real. Use contractions (it's, can't, won't).
5. HUMANITY: Include a slight "human" feel—reflect the personal experience shared by the user. If they mention a struggle, speak from that struggle.
6. NO HALLUCINATIONS: Do not invent facts. Cite only what is visible or common knowledge about the product.
7. SENTIMENT: Analyze the overall tone of the review and classify it as "positive", "negative", or "neutral".

Format the response strictly as JSON.`;

export async function identifyItem(input: { image?: string; link?: string }): Promise<ItemAnalysis> {
  const model = 'gemini-3.1-pro-preview';
  
  const contents: any[] = [];
  if (input.image) {
    const mimeTypeMatch = input.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
    const base64Data = input.image.split(',')[1];
    
    contents.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    });
    contents.push({ text: "Identify the product in this image. If it is a book, prioritize extracting the exact Title and Author from the text on the cover. Use Google Search to verify the book details, description, and key features. Return as JSON." });
  } else if (input.link) {
    contents.push({ text: `Analyze the product at this link: ${input.link}. Use Google Search to look up the URL or product. If it's a book, find the exact title and author. Provide the name, category, description, and key features in JSON.` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_IDENTIFICATION,
      responseMimeType: "application/json",
      tools: [
        { googleSearch: {} }
      ],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          keyFeatures: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["name", "category", "description", "keyFeatures"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

export async function generateHumanReview(item: ItemAnalysis, userContext: string, styleMirror?: StyleMirror): Promise<ReviewOutput> {
  const model = 'gemini-3.1-pro-preview';

  const contents: any[] = [];
  
  let styleContext = "";
  if (styleMirror) {
    if (styleMirror.text) {
      styleContext += `\nSTYLE REFERENCE TEXT: ${styleMirror.text}`;
    }
    if (styleMirror.reviewerName) {
      styleContext += `\nSTYLE REFERENCE REVIEWER: ${styleMirror.reviewerName}`;
    }
    if (styleMirror.reviewerUrl) {
      styleContext += `\nSTYLE REFERENCE URL: ${styleMirror.reviewerUrl}`;
    }
    
    if (styleMirror.image) {
      const mimeTypeMatch = styleMirror.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
      const base64Data = styleMirror.image.split(',')[1];
      
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
      styleContext += `\nSTYLE REFERENCE IMAGE: (Attached image shows the desired writing style/tone)`;
    }
  }

  const prompt = `Item Name: ${item.name}
Description: ${item.description}
User Experience/Thoughts: ${userContext}
${styleContext}

Write a review for this item based on the details above. Write it in the FIRST PERSON as if you are the user who used the item. 
If a STYLE REFERENCE is provided (text, image, or reviewer), MIRROR that style, tone, and vocabulary while maintaining the core personality of Critique Pro (empathetic and truthful).
Be empathetic but truthful. No AI phrases.`;

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_REVIEW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reviewText: { type: Type.STRING },
          rating: { type: Type.NUMBER, description: "Rating out of 5" },
          pros: { type: Type.ARRAY, items: { type: Type.STRING } },
          cons: { type: Type.ARRAY, items: { type: Type.STRING } },
          sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] }
        },
        required: ["reviewText", "rating", "pros", "cons", "sentiment"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

export async function compareProducts(items: ComparisonItem[]): Promise<ComparisonData> {
  const model = 'gemini-3.1-pro-preview';

  const productContext = items.map((item, index) => `
PRODUCT ${index + 1}:
Name: ${item.analysis.name}
Description: ${item.analysis.description}
Features: ${item.analysis.keyFeatures.join(', ')}
Review Sentiment: ${item.review?.sentiment || 'N/A'}
Review Rating: ${item.review?.rating || 'N/A'}
`).join('\n---\n');

  const prompt = `Compare the following products side-by-side. 
Provide a concise summary of the comparison, a detailed feature-by-feature breakdown, and a sentiment analysis overview.

${productContext}

Format the response strictly as JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          featureComparison: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                feature: { type: Type.STRING },
                values: { 
                  type: Type.OBJECT,
                  description: "Map of product name to its value for this feature"
                }
              },
              required: ["feature", "values"]
            }
          },
          sentimentComparison: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                sentiment: { type: Type.STRING },
                score: { type: Type.NUMBER, description: "Sentiment score from 0 to 100" }
              },
              required: ["productName", "sentiment", "score"]
            }
          }
        },
        required: ["summary", "featureComparison", "sentimentComparison"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
}
