# Git Flow

## 1. Начать задачу

```bash
git checkout dev
git pull origin dev
```

```bash
git checkout -b SCRUM-0-title
```

Техническая задача:

```bash
git checkout -b chore/SCRUM-17-setup-tooling
```

---

## 2. Работа и commit

Добавить изменения:

```bash
git add .
git status
```

Commit:

```bash
git commit -m "SCRUM-0 feat: title"
```

Формат commit:

```text
<JIRA-ID> <type>: <description>
```

---

## 3. Обновить ветку через rebase

```bash
git fetch origin
git rebase origin/dev
```

Если конфликт:

```bash
git add .
git rebase --continue
```

Отмена rebase:

```bash
git rebase --abort
```

После rebase:

```bash
git push --force-with-lease
```

---

## 4. Проверка перед PR

```bash
pnpm check
```

---

## 5. Push ветки

Первый push:

```bash
git push -u origin feature/SCRUM-17-login-form
```

После rebase:

```bash
git push --force-with-lease
```

---

## 6. Pull Request

1. Создать PR → `dev`
2. Дождаться CI
3. Получить approve
4. Если `dev` обновился:

```bash

```

---

## 7. Merge

Разрешено:

- Rebase and Merge
- Squash and Merge

После merge:

- удалить branch

---

# Правила

- Не пушить напрямую в `main` и `dev`
- Одна задача = одна branch
- Один PR = одна задача
- Перед PR всегда:
  - `git rebase origin/dev`
  - `pnpm check`

- Не смешивать:
  - feature
  - refactor
  - formatting

- После rebase использовать только:

```bash
git push --force-with-lease
```

Запрещено:

```bash
git push --force
git merge
```

Основано на внутренних docs проекта.
