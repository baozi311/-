/**
 * AI模块
 * 负责与DeepSeek大模型的交互
 */

import { DEEPSEEK_CONFIG } from '../config/index.js' // DeepSeek配置
import https from 'node:https';
import url from 'node:url';

/**
 * 调用DeepSeek大模型生成文本
 * @param {string} prompt 提示文本
 * @param {Array} messages 对话历史消息
 * @returns {Promise<string>} 生成的文本
 */
async function callDeepSeek(prompt, messages = []) {
  try {
    // console.log('开始调用DeepSeek大模型...');
    // console.log('API密钥:', DEEPSEEK_CONFIG.apiKey.substring(0, 5) + '...');
    // console.log('API URL:', DEEPSEEK_CONFIG.baseURL);

    // 系统提示词
    const systemMessage = {
      role: 'system',
      content: '你是一个专业的股票分析师，擅长分析股票历史数据并预测未来趋势。你的分析应该基于提供的历史数据，特别注意总股数的变化会直接影响单价。你需要：1) 分析历史数据中的价格趋势和交易量变化；2) 识别总股数变化与单价之间的相关性；3) 基于历史模式预测未来价格走势；4) 记住自己之前的分析结果，并根据新的实时数据不断优化分析，提高预测准确率。你的分析应该保持客观中立，只关注数据本身，不做任何超出数据范围的猜测。你的回答应该简洁明了，直接给出预测结果，并确保预测的准确率尽可能高。'
    };

    // 构建请求体
    const requestBody = {
      model: DEEPSEEK_CONFIG.model,
      messages: [
        systemMessage,
        ...messages,
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: DEEPSEEK_CONFIG.temperature,
      max_tokens: DEEPSEEK_CONFIG.maxTokens
    };

    // console.log('请求体:', JSON.stringify(requestBody, null, 2));

    // 直接返回测试响应，避免实际调用API
    // 注意：这里暂时使用测试响应，因为实际调用API时遇到了问题

    // 以下是实际调用API的代码，暂时注释掉

    const apiUrl = `${DEEPSEEK_CONFIG.baseURL}/chat/completions`;
    const parsedUrl = url.parse(apiUrl);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`,
        'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
      }
    };

    // console.log('发送请求到DeepSeek API...');
    // console.log('请求选项:', reqOptions);

    // 发送请求
    return new Promise((resolve, reject) => {
      const req = https.request(reqOptions, (res) => {
        // console.log('响应状态:', res.statusCode);
        // console.log('响应头:', res.headers);

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          // console.log('接收到数据块:', chunk.toString());
        });

        res.on('end', () => {
          // console.log('响应数据长度:', data.length);
          // console.log('响应数据前500字符:', data.substring(0, 500));
          try {
            const responseData = JSON.parse(data);
            // console.log('解析JSON成功:', JSON.stringify(responseData, null, 2));
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseData.choices[0].message.content);
            } else {
              throw new Error(`DeepSeek API错误: ${responseData.error?.message || `状态码 ${res.statusCode}`}`);
            }
          } catch (error) {
            console.error('解析响应数据失败:', error);
            console.error('响应数据:', data);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('发送请求失败:', error);
        reject(error);
      });

      // 写入请求体
      req.write(JSON.stringify(requestBody));
      req.end();
    });
  } catch (error) {
    console.error('调用DeepSeek大模型失败:', error);
    throw error;
  }
}

/**
 * 分析股票数据并生成预测
 * @param {Object} stockData 股票数据
 * @returns {Promise<Object>} 结构化的分析结果
 */
async function analyzeStockData(stockData) {
  // 构建提示文本，包含当前盘的所有历史数据
  const historicalData = stockData.data.map((item, index) => {
    return `记录 ${index + 1}:
- 时间: ${item.timestamp}
- 单价: ${item.unitPrice}
- 总股票数: ${item.totalStock}
- 总资金: ${item.totalMoney}
`;
  }).join('\n');

  const prompt = `请分析以下股票数据并提供预测：

盘信息：
- 盘ID: ${stockData.diskId}
- 开始时间: ${stockData.startTime}
- 数据记录数: ${stockData.data.length}
- 最高价: ${stockData.statistics.highPrice}
- 最低价: ${stockData.statistics.lowPrice}
- 最多股: ${stockData.statistics.maxStock}
- 最少股: ${stockData.statistics.minStock}

历史数据：
${historicalData}

最新数据：
- 时间: ${stockData.latest.timestamp}
- 单价: ${stockData.latest.unitPrice}
- 总股票数: ${stockData.latest.totalStock}
- 总资金: ${stockData.latest.totalMoney}

请以JSON格式返回以下信息，只包含这三个字段：
{
  "nextPrice": 下一次股票价格预测值,
  "trend": "上涨"或"下跌",
  "accuracy": AI评估的准确率(0-100)
}

分析要基于提供的所有历史数据，保持客观中立。`

  try {
    // 调用DeepSeek大模型
    const result = await callDeepSeek(prompt)
    // console.log('AI分析结果:', result)

    // 解析JSON响应
    let analysisResult
    try {
      // 提取JSON部分
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        // 如果没有找到JSON，返回默认值
        analysisResult = {
          nextPrice: stockData.latest.unitPrice,
          trend: "上涨",
          accuracy: 50
        }
      }
    } catch (error) {
      console.error('解析AI分析结果失败:', error)
      // 返回默认值
      analysisResult = {
        nextPrice: stockData.latest.unitPrice,
        trend: "上涨",
        accuracy: 50
      }
    }

    // 确保trend只能是上涨或下跌
    if (analysisResult.trend !== '上涨' && analysisResult.trend !== '下跌') {
      analysisResult.trend = '上涨'
    }

    // 只返回必要的字段
    return {
      nextPrice: analysisResult.nextPrice || stockData.latest.unitPrice,
      trend: analysisResult.trend || '上涨',
      accuracy: analysisResult.accuracy || 50
    }
  } catch (error) {
    console.error('分析股票数据失败:', error)
    // 返回默认值
    return {
      nextPrice: stockData.latest.unitPrice,
      trend: "上涨",
      accuracy: 50
    }
  }
}

// 导出模块
export {
  callDeepSeek, // 调用DeepSeek大模型
  analyzeStockData, // 分析股票数据
}