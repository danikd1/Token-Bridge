## Учебный проект: Простой ERC‑20 с доверенным mint/burn

Цель: максимально простой токен на базе OpenZeppelin с функциями `trustedMint` и `trustedBurn`. Выдача прав делается владельцем через маппинг `isTrusted`. Никаких апгрейдов и лишней сложности.

### Стек
- **Hardhat**
- **OpenZeppelin Contracts 5.x**
- **Solidity 0.8.23**

### Структура
- `contracts/TrustedToken.sol` — контракт токена
- `contracts/SimpleBridge.sol` — простой мост (deposit/fulfill + защита от повторов)
- `scripts/` — деплой и вспомогательные скрипты (`setTrusted`, `trustedMint`, `trustedBurn`) + скрипты моста (`deployBridge`, `setRelayer`, `bridgeDeposit`, `bridgeFulfill`)
- `test/TrustedToken.t.js`, `test/SimpleBridge.t.js` — тесты

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

Переменные окружения (необязательно):
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

Примечание: для успешного `mint/burn` транзакции необходимо, чтобы транзакцию подписывал доверенный адрес (см. раздел тестов, либо используйте соответствующий аккаунт в Hardhat).

### Тесты
```bash
npm test
```
Тесты проверяют:
- Владелец может выставлять `isTrusted`
- Посторонний не может менять доверие (ожидаем `OwnableUnauthorizedAccount`)
- Доверенный может `trustedMint` и `trustedBurn`
- Недоверенный получает `"NotTrusted"`
- Сжигание больше баланса вызывает реверт

## Задание 2: Простой мост между сетями

Идея: в исходной сети пользователь вызывает `deposit` → мост сжигает токены и эмитит событие. Оффчейн-релэер читает событие и в целевой сети вызывает `fulfill` → мост выпускает токены. От повторной обработки защищаемся `depositId` (одноразовый идентификатор).

### Что реализовано
- `SimpleBridge.sol`:
  - `deposit(to, amount, dstChainId, depositId)` — сжигает токены у отправителя через `TrustedToken.trustedBurn` и эмитит событие `Deposited`
  - `fulfill(to, amount, depositId)` — только доверенный релэер; выпускает токены `trustedMint`, помечает `depositId` как обработанный, эмитит `Fulfilled`
  - `setRelayer(address,bool)` — владелец настраивает список разрешённых релэеров
  - `isProcessed[depositId]` предотвращает повторы (replay)

Важно: мост должен быть отмечен как доверенный в `TrustedToken` в каждой сети, где он работает (чтобы иметь право `trustedMint/trustedBurn`).

### Быстрый запуск (локально, имитация двух сетей)
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

# выдать мосту доверие в токене (иначе deposit/fulfill не пройдут)
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
# начислим пользователю токены (мост доверенный, может минтаить)
export TO_ADDRESS=0x...           # адрес пользователя-отправителя (в этой сети)
export AMOUNT=1000000000000000000 # 1 токен при 18 знаках
npm run mint                      # минтим пользователю

# пользователь кладёт 0.5 токена на мост
export DST_TO_ADDRESS=0x...       # адрес получателя в целевой сети
export AMOUNT=500000000000000000
export DST_CHAIN_ID=1000
export DEPOSIT_ID=$(node -e "console.log(require('crypto').createHash('sha256').update(Date.now().toString()).digest('hex'))")
npm run bridge:deposit
```
5) Выполнить fulfill (как бы на целевой сети). Для простоты — в том же узле:
```bash
export TO_ADDRESS=$DST_TO_ADDRESS
export AMOUNT=500000000000000000
export DEPOSIT_ID=$DEPOSIT_ID
npm run bridge:fulfill
```

### Как проверить корректность
- При `deposit` сжигается баланс пользователя и эмитится событие `Deposited`. Проверьте баланс пользователя до/после через консоль Hardhat:
```bash
npx hardhat console --network localhost
```
В консоли:
```js
const t = await ethers.getContractAt("TrustedToken", process.env.TOKEN_ADDRESS);
(await t.balanceOf(process.env.TO_ADDRESS)).toString()
```
- При `fulfill` начисляется баланс получателю и эмитится `Fulfilled`.
- Повторный `fulfill` с тем же `DEPOSIT_ID` ревертится с `AlreadyProcessed`.
- Вызов `fulfill` от неразрешённого адреса ревертится с `NotRelayer`.

### Автотесты моста
Запуск:
```bash
npm test
```
Покрывают:
- `deposit` сжигает и эмитит событие
- `fulfill` выпускает токены 1 раз, повтор — реверт
- Только разрешённый релэер может вызывать `fulfill`

## Релэйер (оффчейн)

Простой скрипт `scripts/relayer.js`:
- слушает события `Deposited` в исходной сети,
- проверяет идемпотентность по локальному `relayer_state.json` и по ончейн `isProcessed`,
- вызывает `fulfill` в целевой сети,
- логирует все шаги.

### Быстрый старт (локально в одной сети для демонстрации)
1) Запустить ноду и задеплоить токен/мост как в шагах выше. Отметить мост доверенным и добавить релэера (адрес должен соответствовать приватному ключу ниже).

2) Запустить релэйер (используем один и тот же узел как SRC и DST):
```bash
# адреса мостов (для простоты один и тот же)
export SRC_BRIDGE=$BRIDGE_ADDRESS
export DST_BRIDGE=$BRIDGE_ADDRESS

# RPC (по умолчанию localhost)
export SRC_RPC=http://127.0.0.1:8545
export DST_RPC=http://127.0.0.1:8545

# ключ релэера: возьмите приватный ключ первого аккаунта из лога hardhat node
# пример формата: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export RELAYER_KEY=0x...

npm run relayer
```

3) Инициируйте депозит (как раньше):
```bash
export DST_TO_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
export AMOUNT=500000000000000000
unset DEPOSIT_ID
npm run bridge:deposit
```
Релэйер в логах увидит `Deposited` и выполнит `fulfill` автоматически.

### Как проверить, что релэйер работает
- В логах релэйера видны шаги: событие `Deposited`, отправка `fulfill`, подтверждение транзакции.
- Баланс получателя (`DST_TO_ADDRESS`) увеличился на сумму депозита.
- Повторный депозит с тем же `DEPOSIT_ID` не будет выполнен повторно: релэйер пропустит (видит локально/ончейн), ончейн — вернёт `AlreadyProcessed`.

Если нужно сбросить локальную идемпотентность, удалите `relayer_state.json` в корне проекта (только для демонстрации; в реальности хранение состояния — важно).

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
# Проверьте логи: 4 адреса контрактов, настройка прав, mint 1000 токенов
# Файл deployment.json создан с адресами
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

**Проверочные пункты:**
- ✅ Все юнит-тесты проходят (`npm test`)
- ✅ 4 контракта задеплоены и настроены (`npm run deploy:multi`)
- ✅ Депозит сжигает токены в сети A
- ✅ Событие `Deposited` эмитируется и обнаруживается
- ✅ Fulfill выпускает токены в сети B
- ✅ Балансы изменяются корректно
- ✅ Защита от повторов работает

**Скриншоты для отчёта:**
- Логи `npm test` (все тесты зелёные)
- Логи `npm run deploy:multi` (4 адреса контрактов)
- Логи `npm run test:integration` (полный цикл депозит→fulfill)
- Логи релэйера (обнаружение события и выполнение fulfill)

### Как проверить, что задание выполнено
1) Контракт есть: `contracts/TrustedToken.sol`, наследует ERC20 + Ownable, содержит `mapping(address => bool) isTrusted`, методы `setTrusted`, `trustedMint`, `trustedBurn`.
2) Компиляция проходит: `npm run compile` без ошибок.
3) Тесты проходят: `npm test` — все зелёные.
4) Скрипты работают на локальном узле: деплой, назначение доверенного, выпуск и сжигание происходят без ошибок (см. логи и балансы).

Готово. Репозиторий простой и чистый — только необходимое для учебной задачи.
