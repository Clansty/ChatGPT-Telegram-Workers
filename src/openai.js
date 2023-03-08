import { USER_CONFIG } from './context.js';
import { DATABASE, ENV } from './env.js';

// 发送消息到ChatGPT
export async function sendMessageToChatGPT(message, history) {
  try {
    const body = {
      model: 'gpt-3.5-turbo',
      ...USER_CONFIG.OPENAI_API_EXTRA_PARAMS,
      messages: [...(history || []), { role: 'user', content: message }],
    };
    for (const apiKey of ENV.API_KEYS) {
      if (await DATABASE.get('keyDisabled:' + apiKey)) {
        continue;
      }
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      }).then((res) => res.json());
      if (resp.error?.message) {
        if (resp.error.message.startsWith('Rate limit reached')) {
          await DATABASE.put('keyDisabled:' + apiKey, resp.error.message, { expirationTtl: 60 * 2 });
          continue;
        }
        return `OpenAI API 错误\n> ${resp.error.message}}`;
      }
      return resp.choices[0].message.content;
    }
    return '当前没有可用的 API KEY';
  } catch (e) {
    console.error(e);
    return `请求错误\n> ${e.message}}`;
  }
}

