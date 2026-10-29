/** 几个独立的 AI App，共用同一套本地资料，但走各自的服务。 */
import { mountAssistant } from './ai.js';

const make = brand => (host, ctx) => mountAssistant(host, ctx, brand);

export const mountDeepSeek = make({ id: 'deepseek', name: 'DeepSeek', sub: 'DEEPSEEK', provider: 'deepseek', icon: 'deepseek' });
export const mountChatGPT = make({ id: 'chatgpt', name: 'ChatGPT', sub: 'OPENAI', provider: 'openai', icon: 'chatgpt' });
export const mountClaude = make({ id: 'claude', name: 'Claude', sub: 'ANTHROPIC', provider: 'claude', icon: 'claude' });
export const mountGemini = make({ id: 'gemini', name: 'Gemini', sub: 'GOOGLE', provider: 'gemini', icon: 'gemini' });