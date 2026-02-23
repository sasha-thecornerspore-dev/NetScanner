# Contributing to NetScanner AI

Thanks for your interest in contributing! 🎉

## How to Contribute

### Reporting Bugs

1. Check existing [Issues](https://github.com/sasha-thecornerspore-dev/NetScanner/issues) first
2. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Your OS, Node.js version, and nmap version

### Feature Requests

Open an issue with the `enhancement` label describing:
- What you'd like to see
- Why it would be useful
- Any implementation ideas

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test locally: `npm run dev`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/sasha-thecornerspore-dev/NetScanner.git
cd NetScanner
npm install
npm run dev
```

- Frontend runs on `http://localhost:5173`
- Backend API runs on `http://localhost:3001`

### Code Style

- Use functional React components with hooks
- Follow existing naming conventions
- Keep components focused and single-purpose
- Use the CSS variables defined in `src/index.css`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
