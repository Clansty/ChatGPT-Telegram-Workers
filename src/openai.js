import { USER_CONFIG } from './context.js';
import { DATABASE, ENV } from './env.js';
import { sendMessageToTelegram } from './telegram.js';

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
        if (resp.error.message.startsWith('You exceeded your current quota')) {
          await DATABASE.put('keyDisabled:' + apiKey, resp.error.message);
          await sendMessageToTelegram(apiKey + '\n' + resp.error.message, SHARE_CONTEXT.currentBotToken, { chat_id: 351768429 })
          continue;
        }
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

export const getCredits = async () => {
  const status = await Promise.all(ENV.API_KEYS.map(async key => {
    try {
      const req = await fetch('https://api.openai.com/dashboard/billing/credit_grants', {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      })
      const res = await req.json()
      if (res.error) {
        return `${key}: ${res.error.message}`
      }
      return `${key}: ${res.total_available} / ${res.total_granted}`
    } catch (error) {
      return `${key}: ${error.message}`
    }
  }))
  return status.join('\n')
}