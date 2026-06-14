import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['*.js', '*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['**/*.test.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    {
        ignores: [
            'build/**',
            'node_modules/**',
            '**/*.test.ts',
            'test/**',
            'admin/**',
            '.dev-server/**',
            '.vscode/**',
            '.github/**',
            '*.config.*',
        ],
    },
];
