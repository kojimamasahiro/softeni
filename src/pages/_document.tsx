import { Html, Head, Main, NextScript } from "next/document";

// pages/_document.tsx などで
<Head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</Head>

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
