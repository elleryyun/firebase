class Board {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cells = this.initializeCells();
        this.cellSize = GAME_CONFIG.BOARD_SIZE / 11;
        this.animations = new Map();
        this.players = [];
        this.diceAnimating = false;
        this.diceValue = 1;
    }

    draw(players) {
        this.players = players;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const startX = (this.canvas.width - this.cellSize * 11) / 2;
        const startY = (this.canvas.height - this.cellSize * 11) / 2;

        // 绘制外边框和格子
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, startY, this.cellSize * 11, this.cellSize * 11);

        // 绘制格子
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const [x, y] = this.getPositionCoordinates(i, startX, startY);

            // 绘制格子背景
            this.ctx.fillStyle = GAME_CONFIG.COLORS[cell.type.toUpperCase()];
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

            // === 修改开始：根据owner和level绘制双层边框 ===
            if (cell.type === GAME_CONFIG.CELL_TYPES.LAND && cell.owner) {
                // 外层：玩家颜色
                this.ctx.save();
                this.ctx.lineWidth = 6;
                const ownerPlayer = this.players.find(p => p.name === cell.owner);
                this.ctx.strokeStyle = ownerPlayer ? ownerPlayer.color : '#000';
                this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

                // 内层：根据等级
                this.ctx.lineWidth = 3;
                let levelColors = ["#A020F0", "#FFD700", "#FF9800"]; // 紫色、金色、橙色
                this.ctx.strokeStyle = levelColors[(cell.level || 1) - 1];
                this.ctx.strokeRect(x + 4, y + 4, this.cellSize - 8, this.cellSize - 8);
                this.ctx.restore();
            } else {
                // 普通边框
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
                this.ctx.lineWidth = 2;
            }
            // === 修改结束 ===

            // 绘制格子编号
            this.ctx.fillStyle = '#000';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(i + 1, x + this.cellSize / 2, y + this.cellSize / 2 - 10);

            // 格子名称
            this.ctx.font = '12px Arial';
            this.ctx.fillText(GAME_CONFIG.CELL_NAMES[i], x + this.cellSize / 2, y + this.cellSize / 2 + 12);
        }

        // 绘制所有玩家
        if (players) {
            players.forEach((player, index) => {
                const [x, y] = this.getPositionCoordinates(player.position, startX, startY);
                this.drawPlayer(x, y, player.color, index);
            });
        }

        // 绘制骰子动画（如果正在动画）
        if (this.diceAnimating) {
            this.drawDice(this.diceValue);
        }
    }

    drawDice(value) {
        // 在棋盘正中央绘制骰子
        const size = this.cellSize * 2;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const x = centerX - size / 2;
        const y = centerY - size / 2;

        // 骰子外框
        this.ctx.save();
        this.ctx.globalAlpha = 0.95;
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 4;
        this.ctx.fillRect(x, y, size, size);
        this.ctx.strokeRect(x, y, size, size);

        // 骰子点数
        this.ctx.fillStyle = '#222';
        const dotRadius = size / 10;
        const dotPositions = [
            [0.5, 0.5], // 1
            [0.25, 0.25], [0.75, 0.75], // 2
            [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], // 3
            [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], // 4
            [0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75], // 5
            [0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75] // 6
        ];
        const dotsMap = [
            [0],
            [0, 1],
            [0, 1, 2],
            [0, 1, 2, 3],
            [0, 1, 2, 3, 4],
            [0, 1, 2, 3, 4, 5]
        ];
        // 预设每个点数的坐标
        const dotsPreset = [
            [[0.5, 0.5]],
            [[0.25, 0.25], [0.75, 0.75]],
            [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
            [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
            [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
            [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]]
        ];
        const dots = dotsPreset[value - 1];
        dots.forEach(([dx, dy]) => {
            this.ctx.beginPath();
            this.ctx.arc(x + dx * size, y + dy * size, dotRadius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    // 新增骰子动画方法
    async playDiceAnimation(finalValue) {
        this.diceAnimating = true;
        let frame = 0;
        const totalFrames = 20;
        return new Promise((resolve) => {
            const animate = () => {
                if (frame < totalFrames) {
                    // 随机骰子点数
                    this.diceValue = Math.floor(Math.random() * 6) + 1;
                    this.draw(this.players);
                    frame++;
                    setTimeout(animate, 40);
                } else {
                    // 显示最终点数
                    this.diceValue = finalValue;
                    this.draw(this.players);
                    setTimeout(() => {
                        this.diceAnimating = false;
                        this.draw(this.players);
                        resolve();
                    }, 500);
                }
            };
            animate();
        });
    }

    drawPlayer(x, y, color, index) {
        const radius = this.cellSize / 4;
        const offsetX = (index % 2) * (radius * 1.5);
        const offsetY = Math.floor(index / 2) * (radius * 1.5);
        
        // 检查是否有动画中的位置
        const player = this.players[index];
        const animation = this.animations.get(player.name);
        
        const finalX = animation ? animation.x : x;
        const finalY = animation ? animation.y : y;

        this.ctx.beginPath();
        this.ctx.arc(
            finalX + this.cellSize / 2 + offsetX,
            finalY + this.cellSize / 2 + offsetY,
            radius,
            0,
            Math.PI * 2
        );
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.stroke();

        // 绘制玩家名称
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(player.name, 
            finalX + this.cellSize / 2 + offsetX,
            finalY + this.cellSize / 2 + offsetY + radius + 15
        );
    }

    async animatePlayerMove(player, fromPosition, toPosition) {
        const startX = (this.canvas.width - this.cellSize * 11) / 2;
        const startY = (this.canvas.height - this.cellSize * 11) / 2;

        const [startX1, startY1] = this.getPositionCoordinates(fromPosition, startX, startY);
        const [endX1, endY1] = this.getPositionCoordinates(toPosition, startX, startY);

        const duration = 1000;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const currentX = startX1 + (endX1 - startX1) * progress;
                const currentY = startY1 + (endY1 - startY1) * progress;

                this.animations.set(player.name, { x: currentX, y: currentY });
                this.draw(this.players);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.animations.delete(player.name);
                    resolve();
                }
            };

            animate();
        });
    }

    initializeCells() {
        const cells = [];
        const totalCells = GAME_CONFIG.GRID_COUNT;
        for (let i = 0; i < totalCells; i++) {
            // 判断特殊格子，否则为land
            let type = GAME_CONFIG.CELL_TYPES.LAND;
            if (i === GAME_CONFIG.SPECIAL_CELLS.HOSPITAL) type = GAME_CONFIG.CELL_TYPES.HOSPITAL;
            else if (i === GAME_CONFIG.SPECIAL_CELLS.PRISON) type = GAME_CONFIG.CELL_TYPES.PRISON;
            else if (i === GAME_CONFIG.SPECIAL_CELLS.SHOP) type = GAME_CONFIG.CELL_TYPES.SHOP;
            else if (i === GAME_CONFIG.SPECIAL_CELLS.BANK) type = GAME_CONFIG.CELL_TYPES.BANK;
            else if (i === GAME_CONFIG.SPECIAL_CELLS.CARD) type = GAME_CONFIG.CELL_TYPES.CARD;

            const cell = {
                type: type,
                position: i,
                name: GAME_CONFIG.CELL_NAMES[i],
                price: type === GAME_CONFIG.CELL_TYPES.LAND ? GAME_CONFIG.CELL_PRICES[i] : null,
                owner: null
            };
            if (type === GAME_CONFIG.CELL_TYPES.LAND) {
                cell.level = 1; // 新增：初始等级
            }
            cells.push(cell);
        }
        return cells;
    }

    getRandomCellType() {
        const types = [
            GAME_CONFIG.CELL_TYPES.LAND,
            GAME_CONFIG.CELL_TYPES.SHOP,
            GAME_CONFIG.CELL_TYPES.CARD,
            GAME_CONFIG.CELL_TYPES.HOSPITAL,
            GAME_CONFIG.CELL_TYPES.PRISON
        ];
        return types[Math.floor(Math.random() * types.length)];
    }

    getPositionCoordinates(position, startX, startY) {
        // 逆时针编号：上边(左到右) -> 左边(上到下) -> 下边(右到左) -> 右边(下到上)
        let x, y;
        const size = this.cellSize;

        if (position < 10) { // 上边，左到右
            x = startX + position * size;
            y = startY;
        } else if (position < 20) { // 右边，上到下
            x = startX + 10 * size;
            y = startY + (position - 10) * size;
        } else if (position < 30) { // 下边，右到左
            x = startX + (30 - position) * size;
            y = startY + 10 * size;
        } else { // 左边，下到上
            x = startX;
            y = startY + (40 - position) * size;
        }

        return [x, y];
    }

    drawCell(cell, idx, ctx, players) {
        if (cell.type === GAME_CONFIG.CELL_TYPES.LAND && cell.owner) {
            // 外层：玩家颜色
            ctx.save();
            ctx.lineWidth = 6;
            ctx.strokeStyle = players.find(p => p.name === cell.owner).color;
            ctx.strokeRect(x, y, w, h);
    
            // 内层：根据等级
            ctx.lineWidth = 3;
            let levelColors = ["#A020F0", "#FFD700", "#FF9800"]; // 紫色、金色、橙色
            ctx.strokeStyle = levelColors[(cell.level || 1) - 1];
            ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
            ctx.restore();
        }
    }
}

// 删除下面这段无效代码
// this.cells = GAME_CONFIG.CELL_NAMES.map((name, idx) => {
//     let type = ...; // 原有类型判断
//     let cell = {
//         name,
//         type,
//         price: GAME_CONFIG.CELL_PRICES[idx],
//         owner: null
//     };
//     if (type === GAME_CONFIG.CELL_TYPES.LAND) {
//         cell.level = 1; // 新增：初始等级
//     }
//     return cell;
// });