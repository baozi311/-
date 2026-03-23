(function() {
    'use strict';
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'get_status') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'get_status' }, (response) => {
                        sendResponse(response);
                    });
                }
            });
            return true;
        }
        
        if (request.type === 'send_stock_data') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'stock_data_for_ai',
                        stockData: request.stockData
                    }, (response) => {
                        sendResponse(response);
                    });
                }
            });
            return true;
        }
    });
    
    console.log('[DeepSeek插件] Background service worker 已启动');
    
})();
