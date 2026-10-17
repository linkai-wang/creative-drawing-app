// Scene configuration and mutable selected-background values.
// Loaded first; scenes[sceneId].bg intentionally remains mutable.

   // ✂️ 代码片段 A: 场景数据（已修复完整） ✂️
    const scenes = {
      beach: {
        name: "海滩",
        backgrounds: [
          { id: "beach-sunny", name: "阳光沙滩", url: "./assets/scenes/beach/sunny-beach.webp", thumb: "./assets/scenes/beach/sunny-beach.webp" },
          { id: "beach-sunset", name: "日落沙滩", url: "https://miaobi-how2draw.bj.bcebos.com/miaobi-how2draw/2650293d90675ea002451359fc417c63467e1b74a94318427049f486bbd106d3.png", thumb: "https://miaobi-how2draw.bj.bcebos.com/miaobi-how2draw/2650293d90675ea002451359fc417c63467e1b74a94318427049f486bbd106d3.png" }
        ],
        bg: "./assets/scenes/beach/sunny-beach.webp",
        tasks: [
          { id: "shell", name: "贝壳", description: "不同形状、色彩的贝壳", references: ["./assets/references/beach/shell.webp", "./assets/references/beach/shell.webp", "./assets/references/beach/shell.webp"], instruction: "让我们来画一个漂亮的贝壳吧！先画一个半圆作为贝壳的身体，然后在上面画几道弯弯的纹理，最后给贝壳涂上喜欢的颜色。" },
          { id: "wave", name: "海浪", description: "练习画波纹线条", references: ["./assets/references/beach/wave.webp", "./assets/references/beach/wave.webp", "./assets/references/beach/wave.webp"], instruction: "画海浪很简单哦！先画一条水平线，然后在上面画一些连续的曲线，像S形一样起伏，这样就能画出漂亮的海浪啦。" },
          { id: "crab", name: "小螃蟹", description: "用基础形状组合", references: ["./assets/references/beach/crab.webp", "./assets/references/beach/crab.webp", "./assets/references/beach/crab.webp"], instruction: "小螃蟹由圆形和长方形组成哦！先画一个圆形作为身体，然后画两个小长方形作为钳子，再加上八条细细的腿，最后画两个圆圆的眼睛。" },
          { id: "person", name: "玩耍的人", description: "简单人物线稿", references: ["./assets/references/beach/person.webp", "./assets/references/beach/person.webp", "./assets/references/beach/person.webp"], instruction: "画一个在沙滩上玩耍的人吧！先画一个圆形作为头部，然后画身体和四肢，最后可以加上一些细节，比如头发和衣服。" }
        ],
        interactive: {
          shell: { position: { top: "60%", left: "30%" }, action: "open" },
          wave: { position: { top: "40%", left: "50%" }, action: "move" },
          sand: { position: { top: "70%", left: "50%" }, action: "sparkle" },
          crab: { position: { top: "65%", left: "70%" }, action: "run" },
          person: { position: { top: "55%", left: "20%" }, action: "jump" }
        }
      },
      forest: {
        name: "森林",
        backgrounds: [
          { id: "forest-sunny", name: "晴天森林", url: "./assets/scenes/forest/sunny-forest.webp", thumb: "./assets/scenes/forest/sunny-forest.webp" },
          { id: "forest-snow", name: "雪景森林", url: "./assets/scenes/forest/snowy-forest.webp", thumb: "./assets/scenes/forest/snowy-forest.webp" }
        ],
        bg: "./assets/scenes/forest/sunny-forest.webp",
        tasks: [
          { id: "rabbit", name: "兔子", description: "可爱的森林动物", references: ["./assets/references/forest/rabbit.webp", "./assets/references/forest/rabbit.webp", "./assets/references/forest/rabbit.webp"], instruction: "让我们画一只小兔子吧！先画一个椭圆形作为身体，再画一个圆形作为头部，加上长长的耳朵和短短的四肢，最后画眼睛和嘴巴。" },
          { id: "tiger", name: "老虎", description: "凶猛的丛林之王", references: ["./assets/references/forest/tiger.webp", "./assets/references/forest/tiger.webp", "./assets/references/forest/tiger.webp"], instruction: "老虎有美丽的条纹！先画一个大圆形作为头部，然后画身体和四肢，再加上弯弯的尾巴，最后在身上画一些条纹纹理。" },
          { id: "lion", name: "狮子", description: "草原之王", references: ["./assets/references/forest/lion.webp", "./assets/references/forest/lion.webp", "./assets/references/forest/lion.webp"], instruction: "狮子最有名的是那蓬蓬的鬃毛！先画一个圆形作为头部，然后在周围画放射状的线条作为鬃毛，再加上身体和四肢。" },
          { id: "elephant", name: "大象", description: "温和的巨人", references: ["./assets/references/forest/elephant.webp", "./assets/references/forest/elephant.webp", "./assets/references/forest/elephant.webp"], instruction: "大象的长鼻子是它的特征！先画一个大椭圆形作为身体，再加上四条粗粗的腿，最重要的是要画出那条长长的鼻子哦！" },
          { id: "flower1", name: "花朵1", description: "美丽的花卉", references: ["https://www.puchedu.cn/uploads/0/253/462412096/975457974.jpg", "https://www.puchedu.cn/uploads/0/253/462412096/975457974.jpg", "https://www.puchedu.cn/uploads/0/253/462412096/975457974.jpg"], instruction: "先画一个圆形作为花心，然后在周围画几个花瓣，可以是圆形的也可以是椭圆形的，最后加上花茎和叶子。" },
          { id: "flower2", name: "花朵2", description: "各种美丽的花朵", references: ["https://so1.360tres.com/dr/220__/t016ad344655cbd917e.jpg", "https://so1.360tres.com/dr/220__/t016ad344655cbd917e.jpg", "https://so1.360tres.com/dr/220__/t016ad344655cbd917e.jpg"], instruction: "花朵的形状可以很多样！试试画不同形状的花瓣，有的尖尖的，有的圆圆的，看起来会更有趣哦。" },
          { id: "mushroom", name: "蘑菇", description: "森林的小宝贝", references: ["./assets/references/forest/mushroom.webp", "./assets/references/forest/mushroom.webp", "./assets/references/forest/mushroom.webp"], instruction: "蘑菇很简单哦！先画一个半圆形作为蘑菇的伞，然后画一个长方形作为蘑菇的茎，最后在伞上画一些圆点作为花纹。" }
        ]
      },
      starry: {
        name: "星空",
        backgrounds: [
          { id: "starry-night", name: "星空夜景", url: "./assets/scenes/starry/starry-night.webp", thumb: "./assets/scenes/starry/starry-night.webp" }
        ],
        bg: "./assets/scenes/starry/starry-night.webp",
        tasks: [
          { id: "star1", name: "星星1", description: "五角星", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7VpN8kk2dSHYDwPhwI9Hh8tk4OnywACaBwAApKDwFVnnv-1yxER7jYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7VpN8kk2dSHYDwPhwI9Hh8tk4OnywACaBwAApKDwFVnnv-1yxER7jYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7VpN8kk2dSHYDwPhwI9Hh8tk4OnywACaBwAApKDwFVnnv-1yxER7jYE.jpeg"], instruction: "星星可以画成五角星哦！先画一个点，然后向五个方向画出直线，最后把它们连接起来，形成一个漂亮的星星。" },
          { id: "star2", name: "星星2", description: "闪亮的星星", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7lpN8ksZcj9cephvjGoM1lxyaJ3FgACbBwAApKDwFXWHyBI3svNkDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7lpN8ksZcj9cephvjGoM1lxyaJ3FgACbBwAApKDwFXWHyBI3svNkDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7lpN8ksZcj9cephvjGoM1lxyaJ3FgACbBwAApKDwFXWHyBI3svNkDYE.jpeg"], instruction: "还可以给星星加上闪亮的光线！先画基本的五角星形状，然后在每个角上加上放射状的线条，看起来会闪闪发光。" },
          { id: "moon1", name: "月亮1", description: "圆月", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7dpN8kqbX6K8r135cIDRAikzn59fAACahwAApKDwFWm6CisabR_KzYE.png", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7dpN8kqbX6K8r135cIDRAikzn59fAACahwAApKDwFWm6CisabR_KzYE.png", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7dpN8kqbX6K8r135cIDRAikzn59fAACahwAApKDwFWm6CisabR_KzYE.png"], instruction: "月亮最简单了！直接画一个圆形或半圆形，然后加上一些月球表面的纹理，画几个陨石坑。" },
          { id: "star3", name: "星星3", description: "可爱的星星", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7hpN8ksr9ROh4l5HFXixIUi03ld8gACaxwAApKDwFVpLC5cayO4rTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7hpN8ksr9ROh4l5HFXixIUi03ld8gACaxwAApKDwFVpLC5cayO4rTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7hpN8ksr9ROh4l5HFXixIUi03ld8gACaxwAApKDwFVpLC5cayO4rTYE.jpeg"], instruction: "可以把星星画得更可爱一点！加上眼睛和嘴巴，或者周围的闪闪光线。" },
          { id: "moon2", name: "月亮2", description: "弯弯的月亮", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7tpN8ksxu_ujYOsIzN3GA7Tk3dRfQACbhwAApKDwFVwkvOwg3OT5DYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7tpN8ksxu_ujYOsIzN3GA7Tk3dRfQACbhwAApKDwFVwkvOwg3OT5DYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7tpN8ksxu_ujYOsIzN3GA7Tk3dRfQACbhwAApKDwFVwkvOwg3OT5DYE.jpeg"], instruction: "弯弯的月亮像个微笑的脸！先画一个大圆形，然后在一侧再画一个稍微小一点的圆形，两个圆形重叠的部分就是弯弯的月亮。" },
          { id: "star4", name: "星星4", description: "巨大的星星", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7RpN8kjE7WJCuAUyZmIeFlxVdDDXAACZxwAApKDwFXUempoOvHH3zYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7RpN8kjE7WJCuAUyZmIeFlxVdDDXAACZxwAApKDwFXUempoOvHH3zYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7RpN8kjE7WJCuAUyZmIeFlxVdDDXAACZxwAApKDwFXUempoOvHH3zYE.jpeg"], instruction: "大星星就是简单地把所有线条画得更粗更长，这样会显得更显眼哦。" },
          { id: "star5", name: "星星5", description: "螺旋星星", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7ZpN8klHjJ5t1sZhJd662EdNre2jwACaRwAApKDwFUkEc7Rm2WcLDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7ZpN8klHjJ5t1sZhJd662EdNre2jwACaRwAApKDwFUkEc7Rm2WcLDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX7ZpN8klHjJ5t1sZhJd662EdNre2jwACaRwAApKDwFUkEc7Rm2WcLDYE.jpeg"], instruction: "试试用螺旋线来画星星！先从中心开始画一个螺旋，越来越大，可以创造出独特的效果。" }
        ]
      },
      town: {
        name: "小镇",
        backgrounds: [
          { id: "town-street", name: "小镇街景", url: "./assets/scenes/town/town-street.webp", thumb: "./assets/scenes/town/town-street.webp" }
        ],
        bg: "./assets/scenes/town/town-street.webp",
        tasks: [
          { id: "house1", name: "房子1", description: "可爱的小房子", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5dpN8gISxEo3WgL7oKbBFpmF8uD7gACShwAApKDwFVknXJmLp0iHTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5dpN8gISxEo3WgL7oKbBFpmF8uD7gACShwAApKDwFVknXJmLp0iHTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5dpN8gISxEo3WgL7oKbBFpmF8uD7gACShwAApKDwFVknXJmLp0iHTYE.jpeg"], instruction: "先画一个正方形作为房子的主体，然后在上面画一个三角形作为屋顶，再加上门窗，一个漂亮的房子就画好了。" },
          { id: "house2", name: "房子2", description: "两层楼房", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5BpN8f8vKP8BPcZwauDS9w8-V_mCAACQxwAApKDwFW0LRWFrWf1GTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5BpN8f8vKP8BPcZwauDS9w8-V_mCAACQxwAApKDwFW0LRWFrWf1GTYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5BpN8f8vKP8BPcZwauDS9w8-V_mCAACQxwAApKDwFW0LRWFrWf1GTYE.jpeg"], instruction: "两层房子可以画两个长方形叠在一起，然后分别加上窗户和门，最后加上屋顶。" },
          { id: "house3", name: "房子3", description: "欧式小房", references: ["./assets/references/town/house-3.webp", "./assets/references/town/house-3.webp", "./assets/references/town/house-3.webp"], instruction: "欧式房子可以有更复杂的窗户和装饰，试着加上一些圆形或其他特殊形状的元素。" },
          { id: "house4", name: "房子4", description: "塔楼", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5NpN8gAAVSQnodmix_aG28BcFDqeFQAAkYcAAKSg8BVpc2pbO1Bo082BA.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5NpN8gAAVSQnodmix_aG28BcFDqeFQAAkYcAAKSg8BVpc2pbO1Bo082BA.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5NpN8gAAVSQnodmix_aG28BcFDqeFQAAkYcAAKSg8BVpc2pbO1Bo082BA.jpeg"], instruction: "塔楼是又高又细的，可以用长长的长方形作为主体，然后在顶部加上尖尖的屋顶。" },
          { id: "house5", name: "房子5", description: "别墅", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5hpN8gIWTlK__Hr03TWHG3zcpd7mAACSxwAApKDwFXtMkDCOlAdCzYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5hpN8gIWTlK__Hr03TWHG3zcpd7mAACSxwAApKDwFXtMkDCOlAdCzYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5hpN8gIWTlK__Hr03TWHG3zcpd7mAACSxwAApKDwFXtMkDCOlAdCzYE.jpeg"], instruction: "别墅可以很大很宽，有很多窗户和阳台，看起来很气派。" },
          { id: "house6", name: "房子6", description: "茅草屋", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5VpN8gDV-XtKd5sjjfLrOaAMMAPKgACSBwAApKDwFVefjzFtRqxmDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5VpN8gDV-XtKd5sjjfLrOaAMMAPKgACSBwAApKDwFVefjzFtRqxmDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5VpN8gDV-XtKd5sjjfLrOaAMMAPKgACSBwAApKDwFVefjzFtRqxmDYE.jpeg"], instruction: "茅草屋的屋顶可以用很多小线条表现茅草的质感，看起来很有特色。" },
          { id: "house7", name: "房子7", description: "现代建筑", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5JpN8f-z69deMCFT6rjx-Ix3eh4vAACRRwAApKDwFWZMma5BZBlPDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5JpN8f-z69deMCFT6rjx-Ix3eh4vAACRRwAApKDwFWZMma5BZBlPDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5JpN8f-z69deMCFT6rjx-Ix3eh4vAACRRwAApKDwFWZMma5BZBlPDYE.jpeg"], instruction: "现代建筑的线条很直，可以用长方形和直线来创造几何的美感。" },
          { id: "house8", name: "房子8", description: "圆顶房屋", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5FpN8f9tl1rYTrYbneXbTmuyOQ4xQACRBwAApKDwFXBdcqvcTNGpDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5FpN8f9tl1rYTrYbneXbTmuyOQ4xQACRBwAApKDwFXBdcqvcTNGpDYE.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5FpN8f9tl1rYTrYbneXbTmuyOQ4xQACRBwAApKDwFXBdcqvcTNGpDYE.jpeg"], instruction: "圆顶房屋有特殊的半圆形屋顶，试试用曲线来画屋顶，会显得更特别。" },
          { id: "house9", name: "房子9", description: "创意建筑", references: ["https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5RpN8gAAT5ysRYKSiHo-Uubx8v3QMkAAkccAAKSg8BV6jKzQ3JAEnI2BA.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5RpN8gAAT5ysRYKSiHo-Uubx8v3QMkAAkccAAKSg8BV6jKzQ3JAEnI2BA.jpeg", "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEMX5RpN8gAAT5ysRYKSiHo-Uubx8v3QMkAAkccAAKSg8BV6jKzQ3JAEnI2BA.jpeg"], instruction: "充分发挥想象力！结合不同的形状和颜色，创造出独特的房子设计。" }
        ]
      },
      aquarium: {
        name: "水族馆",
        backgrounds: [
          { id: "aquarium-deep", name: "深海探险", url: "./assets/scenes/aquarium/aquarium-deep.webp", thumb: "./assets/scenes/aquarium/aquarium-deep.webp" },
          { id: "aquarium-coral", name: "珊瑚王国", url: "./assets/scenes/aquarium/aquarium-coral.webp", thumb: "./assets/scenes/aquarium/aquarium-coral.webp" },
          { id: "aquarium-seaweed", name: "海藻森林", url: "https://i.ytimg.com/vi/LqGz6f8-KPQ/hq720.jpg?rs=AOn4CLAhIOgGR5R0zMFgMinZ54DPNi50tQ&sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD", thumb: "https://i.ytimg.com/vi/LqGz6f8-KPQ/hq720.jpg?rs=AOn4CLAhIOgGR5R0zMFgMinZ54DPNi50tQ&sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD" },
          { id: "aquarium-light", name: "丁达尔光海底", url: "https://gd-hbimg.huaban.com/e6495e383f899b0d7b9f0547e33254ce8f57692d179b03-MWBsx2_fw1200webp?auth_key=1765094400-67f16b094a5048ea8c961e6b9f8d1f66-0-39ccd057579e8088e53dad5791dab0fb", thumb: "https://gd-hbimg.huaban.com/e6495e383f899b0d7b9f0547e33254ce8f57692d179b03-MWBsx2_fw1200webp?auth_key=1765094400-67f16b094a5048ea8c961e6b9f8d1f66-0-39ccd057579e8088e53dad5791dab0fb" },
          { id: "aquarium-blue", name: "深蓝之境", url: "https://gd-hbimg.huaban.com/e6c658ddf6cbd09f12db24c20e018fa0d2ec0985a2c8-otVh7E_fw1200webp?auth_key=1765094400-67f16b094a5048ea8c961e6b9f8d1f66-0-92ac51a94daa851332d9fd18677c456a", thumb: "https://gd-hbimg.huaban.com/e6c658ddf6cbd09f12db24c20e018fa0d2ec0985a2c8-otVh7E_fw1200webp?auth_key=1765094400-67f16b094a5048ea8c961e6b9f8d1f66-0-92ac51a94daa851332d9fd18677c456a" }
        ],
        bg: "./assets/scenes/aquarium/aquarium-deep.webp",
        tasks: [
          { id: "dolphin", name: "海豚", description: "聪慧的海洋哺乳动物", references: ["./assets/references/aquarium/dolphin.webp", "./assets/references/aquarium/dolphin.webp", "./assets/references/aquarium/dolphin.webp"], instruction: "海豚是聪慧的海洋朋友！先画一个椭圆形作为身体，然后画一个圆形作为头部，加上弧形的背鳍和尾鳍，最后画眼睛和嘴巴。" },
          { id: "turtle", name: "海龟", description: "古老的海洋生物", references: ["./assets/references/aquarium/turtle.webp", "./assets/references/aquarium/turtle.webp", "./assets/references/aquarium/turtle.webp"], instruction: "海龟有坚硬的壳！先画一个大椭圆形作为龟壳，然后在周围画四条腿和一个头，最后在龟壳上画一些花纹。" },
          { id: "seahorse", name: "海马", description: "优雅的海洋生物", references: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTqyyeT6j1mX3bGEZ5e6s0A3KqmwzdJet6__A&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQb0wjoZ5a5iwwD7kn7Ew7ElgBs4nX1jiP1iQ&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTqyyeT6j1mX3bGEZ5e6s0A3KqmwzdJet6__A&s"], instruction: "海马身体像竹节一样！先画一个弯曲的细长身体，然后加上一个马一样的头，再加上卷曲的尾巴和小小的鱼鳍。" },
          { id: "jellyfish", name: "水母", description: "漂亮的海洋飘客", references: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQq9iwq5tJP_rxRCzDuQiQaoKRMpAKeAmDGDw&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYDEbWRiwbuqnyrV57SBYE5iD-z58a6XPVeg&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQq9iwq5tJP_rxRCzDuQiQaoKRMpAKeAmDGDw&s"], instruction: "水母像一把透明的伞！先画一个半球形作为水母的伞，然后在下面画一些长长的触手，最后可以加上一些圆点装饰。" },
          { id: "seaweed", name: "海藻", description: "海底的植物", references: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6OyiqaH-nHzSp2yGb-430I5IR-S_A7lhuvQ&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTNtVhIrfwWJiElJpEyWUJpuC1K8XABgTwnwg&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6OyiqaH-nHzSp2yGb-430I5IR-S_A7lhuvQ&s"], instruction: "海藻是弯弯的哦！先画一条弯曲的线条作为主茎，然后在两边画一些细长的叶子，让它们看起来像是在水中摇摆。" },
          { id: "coral", name: "珊瑚", description: "五彩斑斓的珊瑚", references: ["https://gd-hbimg.huaban.com/f1931af75bd98f7b7c9e8fcbdb057b883f03d1af365fe-c4EUUP_fw1200webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-3f75a205b0f40ff9ef7d4cbd5cb920c5", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFgFstSmcDqn7dmTc9dsJEFgIEROmW3RlWhg&s", "https://gd-hbimg.huaban.com/f1931af75bd98f7b7c9e8fcbdb057b883f03d1af365fe-c4EUUP_fw1200webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-3f75a205b0f40ff9ef7d4cbd5cb920c5"], instruction: "珊瑚有各种奇怪的形状！可以画成树枝形、扇形或其他奇特的形状，然后加上颜色让它看起来很漂亮。" },
          { id: "treasure", name: "宝箱", description: "隐藏的海底宝藏", references: ["https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpdW_vr6Z5nEG-jCIBIyu8lkS5VV41-yeXPA&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpdW_vr6Z5nEG-jCIBIyu8lkS5VV41-yeXPA&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpdW_vr6Z5nEG-jCIBIyu8lkS5VV41-yeXPA&s"], instruction: "宝箱是方形的！先画一个长方形作为箱子的主体，然后在顶部画一个半圆形作为开口，加上铁质装饰和把手。" },
          { id: "anchor", name: "锚", description: "船只的锚", references: ["https://gd-hbimg.huaban.com/b5938b336dde27dfad2543c2c13a770f13586ef5e227a-kpPO4I_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-c40fcf2814bdbb0530df44a6dbf611b8", "https://gd-hbimg.huaban.com/a5d985e9360f30ac040a4686f1b254523eabcaa133b29-gaI01P_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-f38adcbc1c55b3f3caac7aba1763e05f", "https://gd-hbimg.huaban.com/b5938b336dde27dfad2543c2c13a770f13586ef5e227a-kpPO4I_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-c40fcf2814bdbb0530df44a6dbf611b8"], instruction: "锚像一个倒过来的T形！先画一条竖直的线作为锚杆，然后在下面画两个弧形的锚爪，最后加上绳索。" },
          { id: "diver", name: "潜水员", description: "勇敢的潜水探险家", references: ["https://gd-hbimg.huaban.com/537946f418a1cd618cef539e0c903dadf722d972616e-GGrZBu_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-8d345371a2fbb2d6c5df7fc2c2d87623", "https://gd-hbimg.huaban.com/845826a5845182f20a77ac13ffccfd189e46544b9db7-s8xzdF_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-31fbfbb699e2a1e54179b2dd57df4c24", "https://gd-hbimg.huaban.com/537946f418a1cd618cef539e0c903dadf722d972616e-GGrZBu_fw480webp?auth_key=1765108800-6a7810e7cd2943b8b6859588b6b2596f-0-8d345371a2fbb2d6c5df7fc2c2d87623"], instruction: "潜水员全身都有装备！先画一个圆形作为头部，然后画身体和四肢，加上潜水服和脚蹼，最后画呼吸管和面镜。" }
        ],
        interactive: {
          fish: { position: { top: "50%", left: "40%" }, action: "swim" },
          weed: { position: { top: "60%", left: "70%" }, action: "sway" }
        }
      }
    };

// Share the authored task catalogue with the Node story backend.
if (typeof module !== 'undefined' && module.exports) module.exports = scenes;
