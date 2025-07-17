

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Chat Interface Test</title>
    <!-- Markdown parser library -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        /* Basic chat styles */
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
            background-color: rgba(255, 255, 255, 0.1);
        }
        .assistant {
            background-color: rgba(0, 128, 0, 0.1);
            color: #4CAF50;
        }

        /* Markdown styles */
        h1, h2, h3, h4, h5, h6 {
            color: #4D9FEB;
            margin: 0.8em 0;
        }
        p {
            line-height: 1.6;
            margin: 0.8em 0;
        }
        a {
            color: #4D9FEB;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        strong {
            font-weight: bold;
        }
        em {
            font-style: italic;
        }
        blockquote {
            border-left: 3px solid #ccc;
            padding-left: 1em;
            color: #666;
            margin: 1em 0;
        }
        pre {
            background-color: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            padding: 8px;
            font-family: monospace;
            white-space: pre-wrap;
            word-break: break-all;
        }
        code {
            font-family: monospace;
            background-color: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            padding: 2px 4px;
        }
        ul {
            list-style-type: disc;
            margin-left: 1.5em;
            padding-left: 0;
        }
        ol {
            list-style-type: decimal;
            margin-left: 1.5em;
            padding-left: 0;
        }

        /* Thinking section styles */
        .thinking-section {
            margin: 10px 0;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.08);
            overflow: hidden;
        }
        .thinking-toggle {
            display: flex;
            align-items: center;
            padding: 10px;
            background: rgba(255, 255, 255, 0.12);
            cursor: pointer;
        }
        .thinking-label {
            font-size: 12px;
            font-weight: 600;
            color: #aaa;
            margin-right: 8px;
        }
        .thinking-arrow {
            font-size: 10px;
            color: #aaa;
        }
        .thinking-content {
            padding: 10px;
            font-size: 13px;
            line-height: 1.4;
            color: #ccc;
        }
    </style>
</head>
<body>
    <div id="chat-messages"></div>

    <script>
        // ChatInterface class from chat.js
        class ChatInterface {
            constructor() {
                this.isGenerating = false;
                this.conversationHistory = [];
                this.maxHistoryLength = 20;
                this.startTime = null;
                this.tokenCount = 0;
                this.messageTokens = 0;
                this.config = null;

                // Initialize marked library for markdown parsing
                this.marked = window.marked;

                this.initializeElements();
            }

            initializeElements() {
                // UI elements
                this.chatMessages = document.getElementById('chat-messages');
            }

            escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            convertMarkdownToHtml(markdown) {
                try {
                    // Configure marked with security options
                    this.marked.setOptions({
                        sanitize: true,
                        breaks: true
                    });

                    return this.marked.parse(markdown);
                } catch (error) {
                    console.error('Error parsing markdown:', error);
                    // Fallback to escaped HTML if parsing fails
                    return this.escapeHtml(markdown);
                }
            }

            parseStreamingThinking(content) {
                let html = '';
                let position = 0;
                let inThinking = false;
                let cleanContent = '';

                while (position < content.length) {
                    if (!inThinking) {
                        const thinkStart = content.indexOf('', position);
                        if (thinkEnd !== -1) {
                            const thinkingContent = content.substring(position, thinkEnd);
                            // Escape thinking section content
                            html += this.escapeHtml(thinkingContent);
                            html += `</div></div>`;

                            inThinking = false;
                            position = thinkEnd + 8;
                        } else {
                            const thinkingContent = content.substring(position);
                            // Escape thinking section content
                            html += this.escapeHtml(thinkingContent);
                            break;
                        }
                    }
                }

                if (inThinking) {
                    html += `</div></div>`;
                }

                return { html, cleanContent };
            }

            addMessage(type, content) {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${type}`;

                if (type === 'assistant') {
                    const parsed = this.parseStreamingThinking(content);
                    messageDiv.innerHTML = parsed.html;
                } else {
                    messageDiv.textContent = content;
                }

                this.chatMessages.appendChild(messageDiv);
                return messageDiv;
            }
        }

        // Initialize chat interface
        const chat = new ChatInterface();

        // Test messages
        chat.addMessage('user', 'Hello! How can I help you today?');

        const assistantResponse = `
**Welcome to the AI chat!**

I can help with various tasks:

- Answering questions
- Providing explanations
- Writing code snippets



Would you like some examples of what I can do?
        `;

        chat.addMessage('assistant', assistantResponse);

        const anotherResponse = `
# Here's a markdown heading

This is **bold** and *italic* text.

- Bullet list
- Another item

\`inline code\`

\```javascript
function test() {
    console.log("Code block");
}
\```

> Blockquote example



Regular paragraph text with **bold** and *italic* formatting.
        `;

        chat.addMessage('assistant', anotherResponse);
    </script>
</body>
</html>


