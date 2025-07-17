
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Markdown Test</title>
    <!-- Markdown parser library -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        /* Basic markdown styles */
        h1, h2, h3, h4, h5, h6 {
            color: var(--accent-color);
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
    </style>
</head>
<body>
    <div id="content"></div>

    <script>
        // Test markdown parsing
        const marked = window.marked;

        // Configure with security options
        marked.setOptions({
            sanitize: true,
            breaks: true
        });

        // Test content with various markdown elements
        const testContent = `
# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text*

[Link to Google](https://www.google.com)

> This is a blockquote

- Bullet list item 1
- Bullet list item 2
  - Nested bullet item

1. Numbered list item 1
2. Numbered list item 2

\`inline code\`

\```javascript
function test() {
    console.log("This is a code block");
}
\```

Regular paragraph text with **bold** and *italic* formatting.
        `;

        // Convert to HTML
        const htmlContent = marked.parse(testContent);

        // Display the result
        document.getElementById('content').innerHTML = htmlContent;
    </script>
</body>
</html>
