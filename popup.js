let extractedLinks = [];

document.addEventListener('DOMContentLoaded', function() {
    const extractBtn = document.getElementById('extractBtn');
    const copyBtn = document.getElementById('copyBtn');
    const linkCountElement = document.getElementById('linkCount');
    const loadingElement = document.getElementById('loading');
    const copyFormatSelect = document.getElementById('copyFormat');
    const successMessage = document.getElementById('successMessage');

    // 拡張機能が開かれた時に自動でリンクを抽出
    extractLinks();

    extractBtn.addEventListener('click', extractLinks);
    copyBtn.addEventListener('click', copyToClipboard);

    async function extractLinks() {
        try {
            loadingElement.style.display = 'block';
            extractBtn.disabled = true;

            // 現在のアクティブタブを取得
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // タブの状態をチェック
            if (!tab || !tab.id) {
                throw new Error('アクティブタブが見つかりません');
            }

            // URLの有効性をチェック
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
                throw new Error('この種類のページではリンク抽出はサポートされていません');
            }

            console.log('タブ情報:', { id: tab.id, url: tab.url, status: tab.status });

            // コンテンツスクリプトが読み込まれるまで待機
            await ensureContentScriptLoaded(tab.id);
            
            // コンテンツスクリプトにメッセージを送信（タイムアウト付き）
            const response = await sendMessageWithTimeout(tab.id, { action: 'extractLinks' }, 10000);
            
            if (response && response.links) {
                extractedLinks = response.links;
                linkCountElement.textContent = extractedLinks.length;
                copyBtn.disabled = extractedLinks.length === 0;
                console.log(`${extractedLinks.length}個のリンクを抽出しました`);
            } else {
                throw new Error('リンクの抽出に失敗しました: 無効なレスポンス');
            }
        } catch (error) {
            console.error('リンク抽出エラー:', error);
            linkCountElement.textContent = 'エラー';
            copyBtn.disabled = true;
            
            // エラーの詳細を表示
            if (error.message.includes('chrome://') || error.message.includes('chrome-extension://')) {
                alert('このページではリンク抽出はサポートされていません。\n通常のWebページでお試しください。');
            } else if (error.message.includes('Could not establish connection')) {
                alert('コンテンツスクリプトとの通信に失敗しました。\nページを再読み込みしてから再試行してください。');
            } else {
                console.warn('予期しないエラー:', error.message);
            }
        } finally {
            loadingElement.style.display = 'none';
            extractBtn.disabled = false;
        }
    }

    // コンテンツスクリプトが読み込まれているかチェック
    async function ensureContentScriptLoaded(tabId) {
        try {
            // ping-pongでコンテンツスクリプトの存在確認
            await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        } catch (error) {
            // コンテンツスクリプトが読み込まれていない場合は再注入
            console.log('コンテンツスクリプトを再注入します...');
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            // 少し待機してからもう一度確認
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // タイムアウト付きメッセージ送信
    function sendMessageWithTimeout(tabId, message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('メッセージ送信がタイムアウトしました'));
            }, timeout);

            chrome.tabs.sendMessage(tabId, message, (response) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    async function copyToClipboard() {
        if (extractedLinks.length === 0) {
            alert('コピーするリンクがありません。');
            return;
        }

        const format = copyFormatSelect.value;
        let content = '';

        switch (format) {
            case 'url':
                // URLのみ（改行区切り）
                content = extractedLinks.map(link => link.url).join('\n');
                break;

            case 'text_url':
                // リンクテキスト + URL（改行区切り）
                content = extractedLinks.map(link => {
                    const text = link.text ? link.text.trim() : 'リンクテキストなし';
                    return `${text} - ${link.url}`;
                }).join('\n');
                break;

            case 'markdown':
                // Markdown形式（改行区切り）
                content = extractedLinks.map(link => {
                    const text = link.text ? link.text.trim() : link.url;
                    return `[${text}](${link.url})`;
                }).join('\n');
                break;
        }

        try {
            // クリップボードに書き込み
            await navigator.clipboard.writeText(content);
            
            // 成功メッセージを表示
            showSuccessMessage();
            
            console.log(`${extractedLinks.length}個のリンクをクリップボードにコピーしました`);
        } catch (error) {
            console.error('クリップボードコピーエラー:', error);
            
            // フォールバック: テキストエリアを使用
            try {
                await fallbackCopyToClipboard(content);
                showSuccessMessage();
            } catch (fallbackError) {
                alert('クリップボードへのコピーに失敗しました。ブラウザの設定を確認してください。');
                console.error('フォールバックコピーエラー:', fallbackError);
            }
        }
    }

    // フォールバック方式でクリップボードにコピー
    function fallbackCopyToClipboard(text) {
        return new Promise((resolve, reject) => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('execCommand failed'));
                }
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        });
    }

    // 成功メッセージを表示
    function showSuccessMessage() {
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 2000);
    }
});