class Player {
    constructor(name, color) {
        this.name = name;
        this.color = color;
        this.position = 0;
        this.money = GAME_CONFIG.INIT_CASH;
        this.deposit = GAME_CONFIG.INIT_DEPOSIT;
        this.properties = [];
        this.stocks = [];
        this.items = [];
        this.rate = 0.5;
        this.avatar = 1; // 默认头像编号
    }

    move(steps) {
        // 判断是否路过起点（0号格）
        const oldPos = this.position;
        this.position = (this.position + steps) % GAME_CONFIG.GRID_COUNT;
        // 只要跨过或正好到达0号格，倍率+0.1
        if ((oldPos + steps) >= GAME_CONFIG.GRID_COUNT) {
            this.rate = Math.round((this.rate + 0.1) * 10) / 10;
        }
    }
}