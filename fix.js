import fs from 'fs';
let text = fs.readFileSync('utils/helpers.ts', 'utf8');
text = text.replace(
`export const uid = (prefix: string = 'id'): string => {
  return \`\${prefix}_\${Math.random().toString(36).substr(2, 9)}\`;
};

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return \`\${parts[0]} \${parts[1][0]}.\`;
  return \`\${parts[0]} \${parts[1][0]}. \${parts[2][0]}.\`;
};`,
`export const uid = (prefix: string = 'id'): string => {
  return \`\${prefix}_\${Math.random().toString(36).substr(2, 9)}\`;
};

export const formatFioShort = (fioStr: string): string => {
  if (!fioStr) return '';
  const parts = fioStr.trim().split(/\\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return \`\${parts[0]} \${parts[1][0]}.\`;
  return \`\${parts[0]} \${parts[1][0]}. \${parts[2][0]}.\`;
};`
);
fs.writeFileSync('utils/helpers.ts', text);
