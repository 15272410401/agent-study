/**
 * 工具层：定义 schema（给模型看）+ 实现函数（本地执行）
 *
 * 【本课关键知识点】
 * - Function Calling：模型只“选工具 + 填参数”，真正执行在本地
 * - tools 数组是 JSON Schema 描述，description 写清楚，模型才调得准
 * - executeTool 是统一入口：按 name 分发，返回字符串（通常是 JSON）
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// ===================== 工具 Schema（注册给模型） =====================

/** OpenAI / DeepSeek 兼容的 function calling 工具列表 */
export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description: '获取当前北京时间。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'safe_calculate',
      description: '安全计算基本数学表达式，仅支持数字与 + - * / ()。',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '要计算的数学表达式，例如 "(1 + 2) * 3 / 4"'
          }
        },
        required: ['expression'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_realtime_info',
      description: '根据关键词从互联网获取实时公开信息（摘要/相关条目）。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词，例如「DeepSeek」或「TypeScript 是什么」'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: '获取指定城市的当前天气（温度、天气状况等）。',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称，例如「北京」「上海」「Hangzhou」'
          }
        },
        required: ['city'],
        additionalProperties: false
      }
    }
  }
];

type ToolArgs = Record<string, unknown>;

// ===================== 工具实现 =====================

/** 获取当前北京时间 */
function getCurrentDatetime(): string {
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());

  return JSON.stringify({ timezone: 'Asia/Shanghai', datetime: formatted });
}

/**
 * 安全四则运算。
 * 关键点：绝不能直接 eval 用户/模型传来的任意字符串。
 * 做法：先用正则白名单限制字符，再在受限表达式上求值。
 */
function safeCalculate(args: ToolArgs): string {
  const expression =
    typeof args.expression === 'string' ? args.expression.trim() : '';

  if (!expression) {
    return JSON.stringify({ error: '表达式不能为空' });
  }

  if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
    return JSON.stringify({ expression, error: '仅支持数字与 + - * / ()' });
  }

  try {
    const result = Function(`"use strict"; return (${expression})`)() as unknown;
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return JSON.stringify({ expression, error: '计算结果无效' });
    }
    return JSON.stringify({ expression, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ expression, error: message });
  }
}

/**
 * 关键词检索公开信息（DuckDuckGo Instant Answer）。
 * 适合演示“模型 + 联网工具”，数据完整度有限，正式项目可换成搜索 API。
 */
async function getRealtimeInfo(args: ToolArgs): Promise<string> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  if (!query) {
    return JSON.stringify({ error: 'query 不能为空' });
  }

  try {
    const url = new URL('https://api.duckduckgo.com/');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_redirect', '1');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');

    const response = await fetch(url, {
      headers: { 'User-Agent': 'agent-study-lesson-01' }
    });

    if (!response.ok) {
      return JSON.stringify({
        query,
        error: `请求失败: HTTP ${response.status}`
      });
    }

    const data = (await response.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      Answer?: string;
      Definition?: string;
      RelatedTopics?: Array<
        { Text?: string; FirstURL?: string } | { Topics?: unknown }
      >;
    };

    const related = (data.RelatedTopics ?? [])
      .flatMap((item) => {
        if ('Text' in item && item.Text) {
          return [{ text: item.Text, url: item.FirstURL ?? '' }];
        }
        return [];
      })
      .slice(0, 5);

    return JSON.stringify({
      query,
      heading: data.Heading || '',
      abstract: data.AbstractText || '',
      abstractUrl: data.AbstractURL || '',
      answer: data.Answer || '',
      definition: data.Definition || '',
      related,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ query, error: message });
  }
}

/** Open-Meteo 天气代码 → 中文简述 */
const WEATHER_CODE_MAP: Record<number, string> = {
  0: '晴',
  1: '大体晴朗',
  2: '局部多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '小阵雨',
  81: '阵雨',
  82: '强阵雨',
  95: '雷阵雨',
  96: '雷阵雨伴小冰雹',
  99: '雷阵雨伴大冰雹'
};

/**
 * 查询城市当前天气（Open-Meteo，免费无需 Key）。
 * 步骤：城市名地理编码 → 经纬度查实时天气。
 */
async function getCurrentWeather(args: ToolArgs): Promise<string> {
  const city = typeof args.city === 'string' ? args.city.trim() : '';
  if (!city) {
    return JSON.stringify({ error: 'city 不能为空' });
  }

  try {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.searchParams.set('name', city);
    geoUrl.searchParams.set('count', '1');
    geoUrl.searchParams.set('language', 'zh');
    geoUrl.searchParams.set('format', 'json');

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return JSON.stringify({
        city,
        error: `地理编码失败: HTTP ${geoRes.status}`
      });
    }

    const geoData = (await geoRes.json()) as {
      results?: Array<{
        name: string;
        country?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };

    const place = geoData.results?.[0];
    if (!place) {
      return JSON.stringify({ city, error: `未找到城市: ${city}` });
    }

    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.searchParams.set('latitude', String(place.latitude));
    weatherUrl.searchParams.set('longitude', String(place.longitude));
    weatherUrl.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m'
    );
    weatherUrl.searchParams.set('timezone', place.timezone || 'Asia/Shanghai');

    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) {
      return JSON.stringify({
        city,
        error: `天气请求失败: HTTP ${weatherRes.status}`
      });
    }

    const weatherData = (await weatherRes.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };

    const current = weatherData.current;
    if (!current) {
      return JSON.stringify({ city, error: '未获取到当前天气数据' });
    }

    const code = current.weather_code ?? -1;
    return JSON.stringify({
      city: place.name,
      region: place.admin1 || '',
      country: place.country || '',
      timezone: place.timezone || 'Asia/Shanghai',
      time: current.time || '',
      temperatureC: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeedKmh: current.wind_speed_10m,
      weatherCode: code,
      weather: WEATHER_CODE_MAP[code] ?? `未知(${code})`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ city, error: message });
  }
}

// ===================== 统一分发 =====================

const toolHandlers: Record<
  string,
  (args: ToolArgs) => string | Promise<string>
> = {
  get_current_datetime: getCurrentDatetime,
  safe_calculate: safeCalculate,
  get_realtime_info: getRealtimeInfo,
  get_current_weather: getCurrentWeather
};

/**
 * Agent 调用入口：根据工具名执行对应实现。
 * @param name     工具名（与 schema 中 function.name 一致）
 * @param argsJson 模型返回的 arguments 字符串（JSON）
 */
export async function executeTool(
  name: string,
  argsJson: string
): Promise<string> {
  const handler = toolHandlers[name];
  if (!handler) {
    return JSON.stringify({ error: `未知工具: ${name}` });
  }

  let args: ToolArgs = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as ToolArgs) : {};
  } catch {
    return JSON.stringify({ error: '工具参数不是合法 JSON' });
  }

  return handler(args);
}
