class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = GAME_CONFIG.BOARD_SIZE;
        this.canvas.height = GAME_CONFIG.BOARD_SIZE;
        
        this.players = [
            new Player('玩家1', '#FF0000'),
            new Player('玩家2', '#0000FF')
        ];
        this.currentPlayerIndex = 0;
        
        // 先创建棋盘实例
        this.activeTab = 'asset'; // 初始化默认tab
        this.board = new Board(this.canvas);
        this.initializeGame();
        this.setBanner(); // 新增
    }

    initializeGame() {
        const rollDiceButton = document.getElementById('rollDice');
        rollDiceButton.addEventListener('click', () => this.rollDice());

        // Tab切换事件
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                this.updatePlayerInfo();
            });
        });

        // 直接设置当前玩家提示内容
        document.getElementById('currentPlayer').textContent = `当前玩家: ${this.players[0].name}`;

        this.board.draw(this.players);
        this.updatePlayerInfo();

        // 头像点击事件
        document.getElementById('playerAvatar').addEventListener('click', () => {
            this.showAvatarDialog();
        });

        // 头像选择事件
        $('#avatarDialog').on('click', '.avatar-option', (e) => {
            const avatarId = parseInt(e.target.getAttribute('data-avatar'));
            const avatarNames = [
                "沙隆巴斯", "阿土伯", "钱夫人", "孙小美",
                "金贝贝", "约翰乔", "糖糖", "奥特曼"
            ];
            const player = this.players[this.currentPlayerIndex];
            const oldName = player.name;
            player.avatar = avatarId;
            player.name = avatarNames[avatarId - 1];

            // Update all owned land cells' owner property to the new name
            this.board.cells.forEach(cell => {
                if (cell.owner === oldName) {
                    cell.owner = player.name;
                }
            });

            $('#avatarDialog').dialog('close');
            this.updatePlayerInfo();
        });
    }

    updatePlayerInfo() {
        // Only show current player info in the tab
        const player = this.players[this.currentPlayerIndex];
        const tabContent = document.getElementById('tabContent');
        let html = '';
        if (this.activeTab === 'asset') {
            html = `<div>现金：${player.money}</div><div>存款：${player.deposit}</div>`;
        } else if (this.activeTab === 'stock') {
            html = `<div>股票：${(player.stocks || []).join(', ') || '无'}</div>`;
        } else if (this.activeTab === 'estate') {
            html = `<div>地产：${(player.properties || []).join(', ') || '无'}</div>`;
        } else if (this.activeTab === 'item') {
            html = `<div>道具：${(player.items || []).join(', ') || '无'}</div>`;
        }
        tabContent.innerHTML = html;

        // Update current player label
        const currentPlayerDiv = document.getElementById('currentPlayer');
        currentPlayerDiv.textContent = `当前玩家: ${player.name}`;

        // 更新头像
        const avatarImg = document.getElementById('playerAvatar');
        if (avatarImg) {
            avatarImg.src = `resources/avatar/${player.avatar}.png`;
        }
    }

    showAvatarDialog() {
        // 高亮当前头像
        const player = this.players[this.currentPlayerIndex];
        $('#avatarDialog .avatar-option').removeClass('selected');
        $(`#avatarDialog .avatar-option[data-avatar="${player.avatar}"]`).addClass('selected');
        $('#avatarDialog').dialog({
            modal: true,
            width: 420,
            resizable: false,
            draggable: false,
            closeText: '关闭'
        });
    }

    async rollDice() {
        const rollDiceButton = document.getElementById('rollDice');
        rollDiceButton.disabled = true;

        const steps = Math.floor(Math.random() * 6) + 1;
        document.getElementById('diceResult').textContent = `骰子点数：${steps}`;

        await this.board.playDiceAnimation(steps);

        const currentPlayer = this.players[this.currentPlayerIndex];
        const fromPosition = currentPlayer.position;
        currentPlayer.move(steps);

        await this.board.animatePlayerMove(currentPlayer, fromPosition, currentPlayer.position);

        const cell = this.board.cells[currentPlayer.position];

        // 新增：自己土地可升级
        if (
            cell.type === GAME_CONFIG.CELL_TYPES.LAND &&
            cell.owner === currentPlayer.name
        ) {
            if (cell.level < 3) {
                $("<div>").html(`你到达了自己的土地，当前等级${cell.level}级，是否升级？`).dialog({
                    modal: true,
                    title: "升级房屋",
                    buttons: {
                        "升级": () => {
                            cell.level += 1;
                            this.updatePlayerInfo();
                            this.board.draw(this.players);
                            $(".ui-dialog-content").dialog("close");
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        },
                        "不升级": () => {
                            $(".ui-dialog-content").dialog("close");
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        }
                    }
                });
                return;
            } else {
                $("<div>").html(`你到达了自己的土地，已是最高等级3级。`).dialog({
                    modal: true,
                    title: "升级房屋",
                    buttons: {
                        "确定": () => {
                            $(".ui-dialog-content").dialog("close");
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        }
                    }
                });
                return;
            }
        }

        // 结算过路费
        if (
            cell.type === GAME_CONFIG.CELL_TYPES.LAND &&
            cell.owner &&
            cell.owner !== currentPlayer.name
        ) {
            const ownerPlayer = this.players.find(p => p.name === cell.owner);
            // 计算所有相连同主的土地，地价乘以等级
            const linkedCells = this.getLinkedLands(cell.position, cell.owner);
            // 修改：每块地的价格乘以其等级
            const totalPrice = linkedCells.reduce((sum, idx) => {
                const land = this.board.cells[idx];
                return sum + (land.price * (land.level || 1));
            }, 0);
            const toll = Math.round(totalPrice * ownerPlayer.rate);

            // 新增：现金不足时扣除存款，两者都不足则破产
            let payMsg = "";
            let paid = 0;
            if (currentPlayer.money >= toll) {
                currentPlayer.money -= toll;
                ownerPlayer.money += toll;
                payMsg = `你到达了${cell.owner}的土地，需支付过路费${toll}元（地价${totalPrice}×倍率${ownerPlayer.rate.toFixed(1)}）`;
            } else if (currentPlayer.money + currentPlayer.deposit >= toll) {
                // 现金+存款足够，优先扣现金
                let remain = toll - currentPlayer.money;
                paid = currentPlayer.money;
                currentPlayer.money = 0;
                currentPlayer.deposit -= remain;
                ownerPlayer.money += toll;
                payMsg = `你到达了${cell.owner}的土地，现金不足，已用存款补足，支付过路费${toll}元（地价${totalPrice}×倍率${ownerPlayer.rate.toFixed(1)}）`;
            } else {
                // 现金+存款都不够，破产
                paid = currentPlayer.money + currentPlayer.deposit;
                ownerPlayer.money += paid;
                payMsg = `你到达了${cell.owner}的土地，但现金和存款都不足，已支付全部资产${paid}元，你已破产！`;
                currentPlayer.money = 0;
                currentPlayer.deposit = 0;
                // 回收地产
                this.board.cells.forEach(c => {
                    if (c.owner === currentPlayer.name) {
                        c.owner = null;
                        if (c.type === GAME_CONFIG.CELL_TYPES.LAND) c.level = 1;
                    }
                });
                // 移除玩家
                this.players.splice(this.currentPlayerIndex, 1);
                // 检查是否只剩一人
                if (this.players.length === 1) {
                    $("<div>").html(`玩家${this.players[0].name}获得胜利！`).dialog({
                        modal: true,
                        title: "游戏结束",
                        buttons: {
                            "确定": function() {
                                location.reload();
                            }
                        }
                    });
                    return;
                }
                // 当前玩家已被移除，currentPlayerIndex不变，直接刷新
                this.currentPlayerIndex %= this.players.length;
                this.updatePlayerInfo();
                this.board.draw(this.players);
                $("<div>").html(payMsg).dialog({
                    modal: true,
                    title: "破产",
                    buttons: {
                        "确定": () => {
                            $(".ui-dialog-content").dialog("close");
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        }
                    }
                });
                return;
            }

            $("<div>").html(payMsg).dialog({
                modal: true,
                title: "过路费",
                buttons: {
                    "确定": function() {
                        $(this).closest(".ui-dialog-content").dialog("close");
                    }
                }
            });
            this.updatePlayerInfo();
            this.board.draw(this.players);
        }

        // 检查是否为地产格且无主
        if (
            cell.type === GAME_CONFIG.CELL_TYPES.LAND &&
            !cell.owner
        ) {
            if (currentPlayer.money >= cell.price) {
                $('#buyDialogMsg').html(`${cell.name}，价格${cell.price}元，是否购买？`);
                $("#buyDialog").dialog({
                    modal: true,
                    buttons: {
                        "购买": () => {
                            currentPlayer.money -= cell.price;
                            cell.owner = currentPlayer.name;
                            currentPlayer.properties.push(cell.name);
                            $("#buyDialog").dialog("close");
                            this.updatePlayerInfo();
                            this.board.draw(this.players);
                            // 直接切换到下一名玩家
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        },
                        "取消": function() {
                            $(this).dialog("close");
                            // 取消后立即切换玩家（由 dialogclose 事件处理）
                        }
                    }
                });
                // 取消后切换玩家
                $("#buyDialog").on("dialogclose", () => {
                    $("#buyDialog").off("dialogclose");
                    // 只有未购买时才切换
                    if (!cell.owner) {
                        this.nextPlayerAndUpdate();
                        rollDiceButton.disabled = false;
                    }
                });
                return;
            } else {
                $("<div>").html(`你的现金不足，无法购买${cell.name}。`).dialog({
                    modal: true,
                    title: "提示",
                    buttons: {
                        "确定": () => {
                            $(".ui-dialog-content").dialog("close");
                            this.nextPlayerAndUpdate();
                            rollDiceButton.disabled = false;
                        }
                    }
                });
                return;
            }
        }

        // 不是地产格或已被购买，直接切换玩家
        this.nextPlayerAndUpdate();
        rollDiceButton.disabled = false;
    }

    // 新增：获取所有与指定格子相连、同一owner的土地索引
    getLinkedLands(startIdx, ownerName) {
        const visited = new Set();
        const stack = [startIdx];
        while (stack.length) {
            const idx = stack.pop();
            if (visited.has(idx)) continue;
            visited.add(idx);
            // 检查四个方向
            const neighbors = [
                (idx + 1) % GAME_CONFIG.GRID_COUNT,
                (idx - 1 + GAME_CONFIG.GRID_COUNT) % GAME_CONFIG.GRID_COUNT
            ];
            for (const nIdx of neighbors) {
                const cell = this.board.cells[nIdx];
                if (
                    cell.type === GAME_CONFIG.CELL_TYPES.LAND &&
                    cell.owner === ownerName &&
                    !visited.has(nIdx)
                ) {
                    stack.push(nIdx);
                }
            }
        }
        return Array.from(visited);
    }

    nextPlayerAndUpdate() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.updatePlayerInfo();
        this.board.draw(this.players);
    }

    setBanner() {
        const banner = document.getElementById('banner');
        banner.textContent = `《强手棋之${GAME_CONFIG.CITY_NAME}之旅》`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});