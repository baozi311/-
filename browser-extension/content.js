(function () {
    'use strict';

    const PROJECT_WS_URL = 'ws://localhost:3000';

    let ws = null;
    let isProcessing = false;
    let messageQueue = [];

    function connectToProject() {
        ws = new WebSocket(PROJECT_WS_URL);

        ws.onopen = function () {
            console.log('[DeepSeek插件] 已连接到项目WebSocket服务器');
            ws.send(JSON.stringify({
                type: 'plugin_connected',
                source: 'deepseek_plugin'
            }));
        };

        ws.onmessage = async function (event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'stock_data_for_ai') {
                    messageQueue.push(data);
                    console.log('[DeepSeek插件] 收到股票数据，加入队列，当前队列长度:', messageQueue.length);
                    if (!isProcessing) {
                        processNextMessage();
                    }
                }
            } catch (error) {
                console.error('[DeepSeek插件] 解析消息失败:', error);
            }
        };

        ws.onclose = function () {
            console.log('[DeepSeek插件] WebSocket连接已关闭，5秒后重连...');
            setTimeout(connectToProject, 5000);
        };

        ws.onerror = function (error) {
            console.error('[DeepSeek插件] WebSocket错误:', error);
        };
    }

    async function processNextMessage() {
        if (messageQueue.length === 0) {
            isProcessing = false;
            return;
        }

        isProcessing = true;
        const data = messageQueue.shift();

        try {
            const result = await sendToDeepSeek(data);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'ai_analysis_result',
                    result: result
                }));
            }
        } catch (error) {
            console.error('[DeepSeek插件] 处理消息失败:', error);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'ai_analysis_error',
                    error: error.message
                }));
            }
        }

        setTimeout(processNextMessage, 1000);
    }

    async function sendToDeepSeek(data) {
        if (!window.location.href.includes('deepseek.com')) {
            throw new Error('请在DeepSeek网站上运行此插件');
        }

        const prompt = buildPrompt(data);
        console.log('[DeepSeek插件] 生成的提示词:', prompt);

        const inputSelector = 'textarea, div[contenteditable="true"], [contenteditable]';
        console.log('[DeepSeek插件] 正在查找输入框...');
        const inputElement = await waitForElement(inputSelector, 10000);

        if (!inputElement) {
            console.error('[DeepSeek插件] 找不到输入框');
            throw new Error('找不到DeepSeek输入框');
        }

        console.log('[DeepSeek插件] 找到输入框:', inputElement.tagName);

        inputElement.focus();
        await sleep(200);

        if (inputElement.tagName === 'TEXTAREA') {
            inputElement.value = prompt;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (inputElement.contentEditable === 'true' || inputElement.getAttribute('contenteditable') === 'true') {
            inputElement.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, prompt);
            inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        console.log('[DeepSeek插件] 已填写内容');
        await sleep(1000);

        console.log('[DeepSeek插件] 正在查找发送按钮...');
        const sendButton = await findSendButton();
        console.log('[DeepSeek插件] 发送按钮结果:', sendButton);

        if (sendButton) {
            console.log('[DeepSeek插件] 点击发送按钮');
            sendButton.click();
        } else {
            console.log('[DeepSeek插件] 未找到发送按钮，尝试模拟键盘事件');
            inputElement.focus();

            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            inputElement.dispatchEvent(enterEvent);
        }

        console.log('[DeepSeek插件] 等待AI响应...');
        const response = await waitForAIResponse(120000);

        return response;
    }

    function buildPrompt(data) {
        const { stockData, diskData, diskId } = data;

        let diskDataStr = '暂无历史数据';
        if (diskData && diskData.length > 0) {
            diskDataStr = diskData.map((item, index) => {
                return `[${index + 1}] 单价:${item.unitPrice} 总股数:${item.totalStock} 总资金:${item.totalMoney} 个人股票:${item.personalStock} 个人资金:${item.personalMoney}`;
            }).join('\n');
        }

        return `你是一个股票分析AI。请分析以下股票盘的所有变化数据，预测下一次的数据。

盘ID: ${diskId || '未知'}

当前盘的所有历史变化数据（按时间顺序）：
${diskDataStr}

最新一条数据：
- 单价: ${stockData.unitPrice}
- 总股数: ${stockData.totalStock}
- 总资金: ${stockData.totalMoney}
- 个人股票: ${stockData.personalStock}
- 个人资金: ${stockData.personalMoney}

请分析以上数据的变化趋势，预测下一次数据。

只返回以下JSON格式，不要有任何其他内容：
{
    "nextPrice": 预测的下次单价(数字，保留4位小数),
    "nextTotalStock": 预测的下次总股数(整数),
    "accuracy": 准确率(0-100的整数)
}`;
    }

    async function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    async function findSendButton() {
        console.log('[DeepSeek插件] 开始查找发送按钮...');

        const possibleSelectors = [
            'button[type="submit"]',
            'button.send-button',
            'button[aria-label*="发送"]',
            'button[aria-label*="Send"]',
            'button[class*="send"]',
            'button[class*="Send"]',
            'button[data-testid="send-button"]',
            'button[title*="发送"]',
            'button[title*="Send"]'
        ];

        for (const selector of possibleSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    if (button && !button.disabled) {
                        console.log('[DeepSeek插件] 选择按钮:', selector);
                        return button;
                    }
                }
            } catch (e) { }
        }

        const buttons = document.querySelectorAll('button');
        console.log('[DeepSeek插件] 页面所有按钮:', buttons.length);

        for (const button of buttons) {
            const text = button.textContent.toLowerCase();
            const ariaLabel = button.getAttribute('aria-label') || '';
            const title = button.getAttribute('title') || '';

            if (text.includes('发送') || text.includes('send') ||
                ariaLabel.toLowerCase().includes('发送') || ariaLabel.toLowerCase().includes('send') ||
                title.toLowerCase().includes('发送') || title.toLowerCase().includes('send')) {
                if (!button.disabled) {
                    console.log('[DeepSeek插件] 通过文本找到按钮');
                    return button;
                }
            }
        }

        const allButtons = Array.from(document.querySelectorAll('button'));
        const enabledButtons = allButtons.filter(b => !b.disabled);

        if (enabledButtons.length > 0) {
            const lastButton = enabledButtons[enabledButtons.length - 1];
            console.log('[DeepSeek插件] 返回最后一个启用的按钮');
            return lastButton;
        }

        console.log('[DeepSeek插件] 未找到发送按钮');
        return null;
    }

    async function waitForAIResponse(timeout = 120000) {
        return new Promise((resolve, reject) => {
            let lastResponseText = '';
            let noChangeCount = 0;
            const maxNoChangeCount = 3;
            let startTime = Date.now();
            let resolved = false;
            let timeoutId = null;
            let observer = null;
            let checkInterval = null;

            console.log('[DeepSeek插件] 开始等待AI响应...');

            function parseAndResolve(text) {
                if (resolved) return true;

                console.log('[DeepSeek插件] 解析文本，长度:', text.length);

                const jsonMatch = text.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    console.log('[DeepSeek插件] 找到JSON:', jsonMatch[0]);

                    try {
                        let jsonStr = jsonMatch[0];
                        jsonStr = jsonStr.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
                        jsonStr = jsonStr.replace(/'/g, '"');
                        jsonStr = jsonStr.replace(/,\s*}/g, '}');

                        const result = JSON.parse(jsonStr);
                        console.log('[DeepSeek插件] AI返回结果:', result);

                        resolved = true;
                        if (observer) observer.disconnect();
                        if (checkInterval) clearInterval(checkInterval);
                        if (timeoutId) clearTimeout(timeoutId);
                        resolve(result);
                        return true;
                    } catch (e) {
                        console.error('[DeepSeek插件] JSON解析失败:', e);

                        const nextPriceMatch = text.match(/['"]?nextPrice['"]?\s*[:：]\s*([\d.]+)/i);
                        const nextTotalStockMatch = text.match(/['"]?nextTotalStock['"]?\s*[:：]\s*(\d+)/i);
                        const accuracyMatch = text.match(/['"]?accuracy['"]?\s*[:：]\s*(\d+)/i);

                        if (nextPriceMatch || nextTotalStockMatch || accuracyMatch) {
                            const result = {
                                nextPrice: nextPriceMatch ? parseFloat(nextPriceMatch[1]) : null,
                                nextTotalStock: nextTotalStockMatch ? parseInt(nextTotalStockMatch[1]) : null,
                                accuracy: accuracyMatch ? parseInt(accuracyMatch[1]) : 0
                            };
                            console.log('[DeepSeek插件] 通过正则提取结果:', result);

                            resolved = true;
                            if (observer) observer.disconnect();
                            if (checkInterval) clearInterval(checkInterval);
                            if (timeoutId) clearTimeout(timeoutId);
                            resolve(result);
                            return true;
                        }
                    }
                }
                return false;
            }

            function findResponseElement() {
                const responseSelectors = [
                    '.ds-markdown',
                    '.markdown-body',
                    '.message-content',
                    '.assistant-message',
                    '[data-role="assistant"]',
                    '.chat-message:last-child',
                    '.prose',
                    '[class*="markdown"]',
                    '[class*="response"]',
                    '[class*="answer"]',
                    '.message:last-child',
                    '.chat-body:last-child'
                ];

                for (const selector of responseSelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            return elements[elements.length - 1];
                        }
                    } catch (e) { }
                }

                const allElements = document.querySelectorAll('div, section, article');
                for (let i = allElements.length - 1; i >= 0; i--) {
                    const el = allElements[i];
                    const text = el.textContent || '';
                    if (text.includes('nextPrice') || text.includes('nextTotalStock') || text.includes('accuracy')) {
                        return el;
                    }
                }
                return null;
            }

            observer = new MutationObserver((mutations) => {
                if (resolved) return;

                const responseElement = findResponseElement();
                if (responseElement) {
                    const currentText = responseElement.textContent.trim();

                    if (currentText && currentText !== lastResponseText) {
                        lastResponseText = currentText;
                        noChangeCount = 0;
                        console.log('[DeepSeek插件] DOM变化，文本长度:', currentText.length);

                        if (parseAndResolve(currentText)) {
                            return;
                        }
                    } else if (currentText === lastResponseText && currentText.length > 0) {
                        noChangeCount++;
                        console.log('[DeepSeek插件] 内容未变化，计数:', noChangeCount);

                        if (noChangeCount >= maxNoChangeCount) {
                            if (parseAndResolve(currentText)) {
                                return;
                            }

                            resolved = true;
                            observer.disconnect();
                            if (checkInterval) clearInterval(checkInterval);
                            if (timeoutId) clearTimeout(timeoutId);
                            console.log('[DeepSeek插件] 内容稳定但未找到有效JSON');
                            resolve({
                                nextPrice: null,
                                nextTotalStock: null,
                                accuracy: 0,
                                rawResponse: currentText
                            });
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            checkInterval = setInterval(() => {
                if (resolved) {
                    clearInterval(checkInterval);
                    return;
                }

                const elapsed = Date.now() - startTime;
                console.log('[DeepSeek插件] 轮询检查... 已等待', elapsed, 'ms');

                const responseElement = findResponseElement();
                if (responseElement) {
                    const currentText = responseElement.textContent.trim();
                    if (currentText && currentText !== lastResponseText) {
                        lastResponseText = currentText;
                        noChangeCount = 0;
                        parseAndResolve(currentText);
                    }
                }
            }, 2000);

            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (observer) observer.disconnect();
                    if (checkInterval) clearInterval(checkInterval);
                    console.log('[DeepSeek插件] 等待超时，尝试最后解析');

                    const responseElement = findResponseElement();
                    if (responseElement) {
                        const text = responseElement.textContent.trim();
                        if (parseAndResolve(text)) {
                            return;
                        }
                    }

                    reject(new Error('等待AI响应超时'));
                }
            }, timeout);
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function init() {
        console.log('[DeepSeek插件] 正在初始化...');

        if (window.location.href.includes('deepseek.com')) {
            console.log('[DeepSeek插件] 检测到DeepSeek网站，开始连接...');
            connectToProject();
        } else {
            console.log('[DeepSeek插件] 请在DeepSeek网站上使用此插件');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.deepseekPlugin = {
        sendStockData: async function (data) {
            return await sendToDeepSeek(data);
        },
        connect: connectToProject,
        getStatus: function () {
            return {
                connected: ws && ws.readyState === WebSocket.OPEN,
                processing: isProcessing,
                queueLength: messageQueue.length
            };
        }
    };

})();
