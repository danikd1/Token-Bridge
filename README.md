## ДЗ №1 — Кроссчейн мост между сетями

## Задание 1: Создание токена
### Установка
```bash
npm install
```

### Компиляция
```bash
npm run compile
```

### Локальный узел и деплой
1) Запустить локальный узел:
```bash
npm run node
```
2) В другом терминале задеплоить токен (по умолчанию имя/символ: `Trusted Token`/`TTK`):
```bash
npm run deploy
```

Переменные окружения:
- `TOKEN_NAME`, `TOKEN_SYMBOL` — имя и символ токена
- `TOKEN_OWNER` — адрес владельца (по умолчанию — деплойер)

### Выдача доверия, выпуск и сжигание через скрипты
Перед выполнением экспортируйте `TOKEN_ADDRESS` — адрес задеплоенного контракта.

1) Отметить адрес как доверенный:
```bash
export TOKEN_ADDRESS=0x...   # адрес токена
export TRUSTED_ADDRESS=0x... # кому доверяем
npm run set:trusted
```

2) Выпуск токенов доверенным адресом:
```bash
export TOKEN_ADDRESS=0x...
export TO_ADDRESS=0x...
export AMOUNT=1000000000000000000 # 1 токен, если 18 знаков
npm run mint
```

3) Сжигание токенов доверенным адресом:
```bash
export TOKEN_ADDRESS=0x...
export FROM_ADDRESS=0x...
export AMOUNT=500000000000000000
npm run burn
```
Результат работы
<img width="1159" height="1098" alt="Снимок экрана 2025-10-15 в 17 56 48" src="https://github.com/user-attachments/assets/84220ba5-8e13-45b6-a936-534d9812f682" />


## Задание 2: Разработка моста

Идея: в исходной сети пользователь вызывает `deposit` → мост сжигает токены и эмитит событие. Оффчейн-релэер читает событие и в целевой сети вызывает `fulfill` → мост выпускает токены. От повторной обработки защищаемся `depositId` (одноразовый идентификатор).

### Что реализовано
- `SimpleBridge.sol`:
  - `deposit(to, amount, dstChainId, depositId)` — сжигает токены у отправителя через `TrustedToken.trustedBurn` и эмитит событие `Deposited`
  - `fulfill(to, amount, depositId)` — только доверенный релэер; выпускает токены `trustedMint`, помечает `depositId` как обработанный, эмитит `Fulfilled`
  - `setRelayer(address,bool)` — владелец настраивает список разрешённых релэеров
  - `isProcessed[depositId]` предотвращает повторы (replay)

Важно: мост должен быть отмечен как доверенный в `TrustedToken` в каждой сети, где он работает (чтобы иметь право `trustedMint/trustedBurn`).

### Быстрый запуск (имитация двух сетей)
1) Запустить локальный узел:
```bash
npm run node
```
2) Деплой токена и моста (в одном узле для демонстрации):
```bash
# деплой токена
npm run deploy
export TOKEN_ADDRESS=0x...  # адрес из лога деплоя

# деплой моста
npm run deploy:bridge
export BRIDGE_ADDRESS=0x... # адрес из лога деплоя

# выдать мосту доверие в токене
export TRUSTED_ADDRESS=$BRIDGE_ADDRESS
npm run set:trusted
```
3) Настроить релэера (например, пусть релэером будет деплойер):
```bash
export RELAYER_ADDRESS=0x... # адрес аккаунта, который будет вызывать fulfill
npm run bridge:setRelayer
```
4) Подготовить баланс пользователя и сделать депозит:
```bash
# начислим пользователю токены 
export TO_ADDRESS=0x...           # адрес пользователя-отправителя
export AMOUNT=1000000000000000000 # 1 токен при 18 знаках
npm run mint

# пользователь кладёт 0.5 токена на мост
export DST_TO_ADDRESS=0x...       # адрес получателя в целевой сети
export AMOUNT=500000000000000000
export DST_CHAIN_ID=1000
export DEPOSIT_ID=$(node -e "console.log(require('crypto').createHash('sha256').update(Date.now().toString()).digest('hex'))")
npm run bridge:deposit
```
5) Выполнить fulfill
```bash
export TO_ADDRESS=$DST_TO_ADDRESS
export AMOUNT=500000000000000000
export DEPOSIT_ID=$DEPOSIT_ID
npm run bridge:fulfill
```

- При `fulfill` начисляется баланс получателю и эмитится `Fulfilled`.
- Повторный `fulfill` с тем же `DEPOSIT_ID` ревертится с `AlreadyProcessed`.
- Вызов `fulfill` от неразрешённого адреса ревертится с `NotRelayer`.

Результат работы
<img width="1157" height="1099" alt="Снимок экрана 2025-10-15 в 17 58 19" src="https://github.com/user-attachments/assets/29c0ce14-674c-4876-9b6a-c50c984ef6f1" />

<img width="1270" height="1104" alt="Снимок экрана 2025-10-15 в 20 38 58" src="https://github.com/user-attachments/assets/eef29a2e-7cc0-460f-b2f6-4f6885a5bcbf" />

## Задание 3: Взаимодействие между сетями
## Релэйер
### Быстрый старт (локально в одной сети для демонстрации)
1) Запустить релэйер (используем один и тот же узел как SRC и DST):
```bash
# адреса мостов (для простоты один и тот же)
export SRC_BRIDGE=$BRIDGE_ADDRESS
export DST_BRIDGE=$BRIDGE_ADDRESS
export SRC_RPC=http://127.0.0.1:8545
export DST_RPC=http://127.0.0.1:8545

# ключ релэера: приватный ключ первого аккаунта из лога hardhat node
export RELAYER_KEY=0x...

npm run relayer
```

2) Инициируйте депозит:
```bash
export DST_TO_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
export AMOUNT=500000000000000000
unset DEPOSIT_ID
npm run bridge:deposit
```
Релэйер в логах увидит `Deposited` и выполнит `fulfill` автоматически.

Результат работы
<img width="1792" height="1082" alt="Снимок экрана 2025-10-16 в 21 50 25" src="https://github.com/user-attachments/assets/e2242630-e2b4-4994-bb90-39dd62b7e8e0" />

## Задание 4: Тестирование и деплой (полный цикл)
### Юнит-тесты для контракта моста

Запуск всех тестов:
```bash
npm test
```

Покрытие тестов:
- ✅ `deposit` сжигает токены и эмитит событие `Deposited` с правильными параметрами
- ✅ `fulfill` выпускает токены и эмитит событие `Fulfilled`
- ✅ Защита от повторов: повторный `fulfill` с тем же `depositId` ревертится `AlreadyProcessed`
- ✅ Только владелец может вызывать `setRelayer`
- ✅ Только разрешённый релэер может вызывать `fulfill`
- ✅ `setRelayer` эмитит событие `RelayerUpdated`
- ✅ Правильные изменения балансов при `deposit` (сжигание) и `fulfill` (выпуск)
- ✅ `isProcessed` корректно отслеживает обработанные депозиты

### Деплой четырёх контрактов (2 токена + 2 моста)

1) Запустить локальный узел:
```bash
npm run node
```

2) В другом терминале — деплой всех контрактов:
```bash
npm run deploy:multi
```

Скрипт автоматически:
- Деплоит `TokenA` и `TokenB` (по 1000 токенов деплойеру)
- Деплоит `BridgeA` и `BridgeB`
- Настраивает права: мосты доверенные в своих токенах
- Добавляет деплойера как релэера для обоих мостов
- Сохраняет адреса в `deployment.json`

### Интеграционный тест (депозит + релэйер + fulfill)

После деплоя запустите полный цикл:
```bash
npm run test:integration
```

Скрипт выполняет:
1. **Депозит в сети A**: сжигает 10 токенов у отправителя
2. **Обнаружение события**: находит событие `Deposited` в логах
3. **Fulfill в сети B**: выпускает 10 токенов получателю
4. **Проверка балансов**: показывает изменения до/после

### Как проверить выполнение задания

**Юнит-тесты (2 балла):**
```bash
npm test
# Должны пройти все 8 тестов для SimpleBridge
```

**Деплой четырёх контрактов (2 балла):**
```bash
npm run deploy:multi
# 4 адреса контрактов, настройка прав, mint 1000 токенов
```

**Тестирование в локальной сети (2 балла):**
```bash
# 1) Запустить узел
npm run node

# 2) Деплой (в другом терминале)
npm run deploy:multi

# 3) Интеграционный тест
npm run test:integration

# 4) Проверка логов релэйера (опционально)
export SRC_BRIDGE=$(jq -r '.networks.A.bridge' deployment.json)
export DST_BRIDGE=$(jq -r '.networks.B.bridge' deployment.json)
export RELAYER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
npm run relayer
```

Результат работы
<img width="1791" height="1088" alt="Снимок экрана 2025-10-20 в 20 17 36" src="https://github.com/user-attachments/assets/1e3d223b-f063-4921-a64d-1d1e0ca026db" />

