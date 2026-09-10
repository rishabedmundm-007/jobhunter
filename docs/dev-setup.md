# Dev setup

One-time setup for a development laptop. Estimated time: 45–60 minutes, most of it downloads.

Two paths: **macOS** (Homebrew) or **Windows** (WSL2 + Ubuntu). On Windows, do everything inside the Ubuntu terminal — Lambda runs Linux, Docker builds are Linux, and the CDK toolchain is far less fragile there than in PowerShell.

---

## 1. Core tools

### macOS

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install python@3.12 node@20 awscli git pre-commit uv jq
brew install --cask docker visual-studio-code
npm install -g aws-cdk
```

Open Docker Desktop once so it finishes its first-run setup.

### Windows

In an **admin PowerShell**:

```powershell
wsl --install -d Ubuntu-24.04
```

Reboot, open "Ubuntu" from the Start menu, create your Linux username. Then install **Docker Desktop for Windows** and **VS Code** from their sites. In Docker Desktop → Settings → Resources → WSL integration, enable Ubuntu-24.04. In VS Code, install the **WSL** extension and open folders via `code .` from the Ubuntu terminal.

Inside Ubuntu:

```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv python3-pip unzip jq git pipx
pipx ensurepath && pipx install pre-commit
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip && unzip -q awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip
sudo npm install -g aws-cdk
```

Close and reopen the terminal so `PATH` changes take effect.

### Verify versions (both platforms)

```bash
python3.12 --version   # 3.12.x
node --version         # v20.x
npm --version
aws --version          # aws-cli/2.x
cdk --version          # 2.x
docker --version && docker run --rm hello-world
git --version
pre-commit --version
uv --version
```

---

## 2. Git and GitHub

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input      # important on Windows/WSL

ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
```

Paste the public key into GitHub → Settings → SSH and GPG keys. Test with `ssh -T git@github.com`.

---

## 3. AWS access via IAM Identity Center (SSO)

Never create IAM user access keys for daily work. Use SSO; tokens expire and re-auth is one command.

Prerequisite from step 2 of the Phase 0 plan: Identity Center is enabled, you have a user, and an `AdministratorAccess` permission set is assigned to the project account. Note the **AWS access portal URL** (looks like `https://d-xxxxxxxxxx.awsapps.com/start`).

```bash
aws configure sso
```

Answer the prompts:

| Prompt | Value |
|---|---|
| SSO session name | `job-search` |
| SSO start URL | your access portal URL |
| SSO region | `us-east-1` |
| SSO registration scopes | accept default |
| (browser opens — sign in and approve) | |
| Account / role | your project account, `AdministratorAccess` |
| CLI default client region | `us-east-1` |
| CLI default output format | `json` |
| CLI profile name | `job-dev` |

Make it the default for every shell:

```bash
echo 'export AWS_PROFILE=job-dev' >> ~/.zshrc    # macOS (zsh)
echo 'export AWS_PROFILE=job-dev' >> ~/.bashrc   # Ubuntu/WSL
```

Daily login and check:

```bash
aws sso login
aws sts get-caller-identity
```

Expected output includes your 12-digit account ID and an ARN containing `AWSReservedSSO_AdministratorAccess`.

---

## 4. Bootstrap CDK (once per account/region)

CDK needs a small staging stack (S3 bucket, ECR repo, IAM roles) in the target account.

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1
cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/us-east-1
```

Add both `export` lines to your shell rc file too. Verify in the console: CloudFormation → stack `CDKToolkit` in `CREATE_COMPLETE`.

---

## 5. Project-local setup (after the repo scaffold exists)

```bash
git clone git@github.com:<you>/<repo>.git && cd <repo>
uv sync                       # Python deps for infra/ and services/
(cd web && npm install)       # frontend deps
pre-commit install            # ruff, black, mypy, eslint, prettier, gitleaks on every commit
make synth                    # cdk synth — must succeed with no AWS calls
make deploy-dev               # first deploy of the empty stacks
```

`make synth` passing on a clean clone is the real test that the laptop is ready.

---

## 6. VS Code extensions

Python, Pylance, Ruff, ESLint, Prettier, Tailwind CSS IntelliSense, Markdown Preview Mermaid Support, AWS Toolkit, Docker. On Windows also: WSL.

Workspace settings worth committing in `.vscode/settings.json`: format on save, Ruff as the Python formatter, Prettier for `web/`.

---

## 7. Gotchas

| Symptom | Fix |
|---|---|
| `Unable to locate credentials` / `Token has expired` | `aws sso login` — SSO sessions last ~8–12 h |
| `cdk deploy` fails building the Playwright Lambda image | Docker Desktop must be running; on Windows, WSL integration must be enabled for Ubuntu |
| `cdk bootstrap` says already bootstrapped but deploy fails on permissions | Re-run bootstrap after any change to the deploy role; check `CDKToolkit` stack has no drift |
| Pre-commit hooks fail with CRLF errors on Windows | `git config --global core.autocrlf input`, then `git add --renormalize .` |
| Node version mismatch warnings from CDK | Ensure `node --version` is 20.x; remove any older global Node |
| `pip install` outside a venv errors | Always use `uv sync` / `uv run` — never system pip |
| Slow file I/O in WSL | Keep the repo under `~/` inside Ubuntu, not under `/mnt/c/` |

---

## 8. Done when

- [ ] `aws sts get-caller-identity` returns your project account
- [ ] `docker run --rm hello-world` works
- [ ] `CDKToolkit` stack exists in us-east-1
- [ ] `make synth` passes on a clean clone
- [ ] `git commit` triggers pre-commit hooks
