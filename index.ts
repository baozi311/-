import { Context, Schema } from 'koishi';

export interface StockData
{
  unitPrice: number;
  totalStock: number;
  personalStock: number;
  totalMoney: number;
  personalMoney: number;
}

export interface Config
{
  apiUrl: string;
  apiMethod: 'GET' | 'POST' | 'PUT';
  apiHeaders: Record<string, string>;
  enableLogging: boolean;
  retryCount: number;
  retryDelay: number;
  enableWebSocket: boolean;
  wsUrl: string;
  wsReconnectInterval: number;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    apiUrl: Schema.string().required().description('股票监测网站的 API 地址'),
    apiMethod: Schema.union(['GET', 'POST', 'PUT'] as const).default('POST').description('HTTP 请求方法'),
    apiHeaders: Schema.dict(Schema.string()).default({
      'Content-Type': 'application/json'
    }).description('HTTP 请求头'),
    enableLogging: Schema.boolean().default(true).description('是否启用日志记录'),
    retryCount: Schema.number().min(0).max(10).default(3).description('失败重试次数'),
    retryDelay: Schema.number().min(100).max(10000).default(1000).description('重试延迟（毫秒）'),
  }).description('API 配置'),
  Schema.object({
    enableWebSocket: Schema.boolean().default(false).description('是否启用 WebSocket 长连接'),
    wsUrl: Schema.string().default('ws://localhost:3000').description('WebSocket 服务器地址'),
    wsReconnectInterval: Schema.number().min(1000).max(30000).default(5000).description('WebSocket 重连间隔（毫秒）'),
  }).description('WebSocket 配置'),
]);

export const name = 'stock-monitor';

export function apply(ctx: Context, config: Config)
{
  ctx.logger.info('股票监测插件已启动');

  let ws: WebSocket | null = null;
  let wsReconnectTimer: NodeJS.Timeout | null = null;

  function connectWebSocket()
  {
    if (!config.enableWebSocket) return;

    try
    {
      ws = new WebSocket(config.wsUrl);

      ws.onopen = () =>
      {
        if (config.enableLogging)
        {
          ctx.logger.info(`WebSocket 连接成功: ${config.wsUrl}`);
        }
        // 清除重连定时器
        if (wsReconnectTimer)
        {
          clearTimeout(wsReconnectTimer);
          wsReconnectTimer = null;
        }
      };

      ws.onclose = () =>
      {
        if (config.enableLogging)
        {
          ctx.logger.info('WebSocket 连接关闭');
        }
        // 重连
        reconnectWebSocket();
      };

      ws.onerror = (error) =>
      {
        if (config.enableLogging)
        {
          ctx.logger.error('WebSocket 错误:', error);
        }
      };

      ws.onmessage = (event) =>
      {
        if (config.enableLogging)
        {
          ctx.logger.info('收到 WebSocket 消息:', event.data);
        }
      };
    } catch (error)
    {
      if (config.enableLogging)
      {
        ctx.logger.error('WebSocket 连接失败:', error);
      }
      reconnectWebSocket();
    }
  }

  function reconnectWebSocket()
  {
    if (!config.enableWebSocket || wsReconnectTimer)
    {
      return;
    }

    if (config.enableLogging)
    {
      ctx.logger.info(`正在尝试重连 WebSocket，间隔 ${config.wsReconnectInterval}ms`);
    }

    wsReconnectTimer = setTimeout(() =>
    {
      wsReconnectTimer = null;
      connectWebSocket();
    }, config.wsReconnectInterval);
  }

  function sendWebSocketData(stockData: StockData): boolean
  {
    if (!config.enableWebSocket || !ws || ws.readyState !== WebSocket.OPEN)
    {
      return false;
    }

    try
    {
      ws.send(JSON.stringify(stockData));
      if (config.enableLogging)
      {
        ctx.logger.info(`WebSocket 数据发送成功: ${config.wsUrl}`);
        ctx.logger.info('发送数据:', stockData);
      }
      return true;
    } catch (error)
    {
      if (config.enableLogging)
      {
        ctx.logger.error('WebSocket 数据发送失败:', error);
      }
      return false;
    }
  }

  async function sendStockData(stockData: StockData, retryAttempt: number = 0): Promise<boolean>
  {
    try
    {
      const url = new URL(config.apiUrl);

      if (config.apiMethod === 'GET')
      {
        Object.entries(stockData).forEach(([key, value]) =>
        {
          url.searchParams.append(key, String(value));
        });
      }

      const options: RequestInit = {
        method: config.apiMethod,
        headers: config.apiHeaders,
      };

      if (config.apiMethod !== 'GET')
      {
        options.body = JSON.stringify(stockData);
      }

      if (config.enableLogging)
      {
        ctx.logger.info(`正在发送股票数据到地址: ${url.toString()}`);
        ctx.logger.info(`发送方法: ${config.apiMethod}`);
        ctx.logger.info(`发送数据:`, stockData);
      }

      const response = await fetch(url.toString(), options);

      if (config.enableLogging)
      {
        ctx.logger.info(`收到响应: ${response.status} ${response.statusText}`);
        try
        {
          const responseText = await response.clone().text();
          ctx.logger.info(`响应内容: ${responseText}`);
        } catch (e)
        {
          ctx.logger.info('无法解析响应内容');
        }
      }

      if (response.ok)
      {
        if (config.enableLogging)
        {
          ctx.logger.info(`股票数据发送成功! 发送到地址: ${url.toString()}`);
          ctx.logger.info('发送数据:', stockData);
        }
        return true;
      } else
      {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error)
    {
      if (config.enableLogging)
      {
        ctx.logger.error(`股票数据发送失败 (尝试 ${retryAttempt + 1}/${config.retryCount}):`, error);
      }

      if (retryAttempt < config.retryCount)
      {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        return sendStockData(stockData, retryAttempt + 1);
      }

      return false;
    }
  }

  // 初始化 WebSocket 连接
  if (config.enableWebSocket)
  {
    connectWebSocket();
  }

  (ctx as any).on('iirose/stock-update', async (stockData: any) =>
  {
    if (config.enableLogging)
    {
      ctx.logger.info('收到股票更新事件:', stockData);
    }

    // 通过 WebSocket 发送数据
    if (config.enableWebSocket)
    {
      const wsSuccess = sendWebSocketData(stockData);
      if (wsSuccess && config.enableLogging)
      {
        ctx.logger.info('股票数据通过 WebSocket 发送成功');
      }
    }

    // 通过 HTTP 发送数据
    const httpSuccess = await sendStockData(stockData);

    if (!httpSuccess && config.enableLogging)
    {
      ctx.logger.error('股票数据通过 HTTP 发送失败，已达到最大重试次数');
    }
  });

  ctx.command('stock.test', '测试股票数据发送')
    .action(async ({ session }) =>
    {
      const bot = session.bot;
      if (bot.platform !== 'iirose')
      {
        return '此命令仅适用于 IIROSE 机器人';
      }

      const testData: StockData = {
        unitPrice: 10.5,
        totalStock: 1000,
        personalStock: 100,
        totalMoney: 10000,
        personalMoney: 1000,
      };

      let results = [];

      // 测试 WebSocket 发送
      if (config.enableWebSocket)
      {
        const wsSuccess = sendWebSocketData(testData);
        results.push(`WebSocket 发送: ${wsSuccess ? '成功' : '失败'}`);
      } else
      {
        results.push('WebSocket: 未启用');
      }

      // 测试 HTTP 发送
      const httpSuccess = await sendStockData(testData);
      results.push(`HTTP 发送: ${httpSuccess ? '成功' : '失败'}`);

      return `测试结果：\n${results.join('\n')}`;
    });

  ctx.command('stock.config', '查看当前配置')
    .action(() =>
    {
      return `当前配置：
API 地址：${config.apiUrl}
请求方法：${config.apiMethod}
启用日志：${config.enableLogging}
重试次数：${config.retryCount}
重试延迟：${config.retryDelay}ms
启用 WebSocket：${config.enableWebSocket}
WebSocket 地址：${config.wsUrl}
WebSocket 重连间隔：${config.wsReconnectInterval}ms`;
    });

  ctx.command('stock.query', '主动请求股票数据')
    .action(async ({ session }) =>
    {
      const bot = session.bot;
      if (bot.platform !== 'iirose')
      {
        return '此命令仅适用于 IIROSE 机器人';
      }

      try
      {
        if (config.enableLogging)
        {
          ctx.logger.info('正在主动请求股票数据...');
        }

        const iiroseBot = bot as any;

        if (iiroseBot && iiroseBot.sendAndWaitForResponse)
        {
          const response = await iiroseBot.sendAndWaitForResponse('>#', '>', false, 5000);

          if (response && config.enableLogging)
          {
            ctx.logger.info('股票数据请求成功:', response);
            return '股票数据请求成功！';
          } else
          {
            return '股票数据请求失败或超时';
          }
        } else
        {
          return 'IIROSE 机器人不支持此功能';
        }
      } catch (error)
      {
        if (config.enableLogging)
        {
          ctx.logger.error('主动请求股票数据失败:', error);
        }
        return `请求失败：${error.message}`;
      }
    });
}