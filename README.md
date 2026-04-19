This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## FlowCode process expressions

Process blocks execute a safe JavaScript subset. They support declarations,
assignments, property access, array/object literals, template literals,
comparisons, arithmetic, function calls allowed by the runtime whitelist, and
callbacks for array helpers such as `map`, `filter`, `find`, `some`, `every`,
`reduce`, and `sort`.

The safe whitelist includes common `Math` helpers, `Math.PI`, `Object.keys`,
`Object.values`, `Object.entries`, string methods like `trim`, `includes`,
`slice`, `replace`, `split`, array methods like `push`, `pop`, `join`, and
character helpers such as `charToCode`, `codeToChar`, `codePointAt`, and
`fromCodePoint`. 

Dynamic execution through `eval`, `Function`, `window`, or
`document` is not supported.

