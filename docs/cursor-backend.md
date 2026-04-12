# FastHousing — 后端 & 爬虫 Cursor Prompt

## 使用说明

按顺序执行。Prompt 1-2 搭建后端基础，Prompt 3 实现爬虫，Prompt 4 对接前端。

---

## Prompt 1: 后端项目初始化

```
创建 FastHousing 后端项目，技术栈：Python FastAPI + PostgreSQL + Redis。

项目结构：
```
fasthousing-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口，包含 CORS、路由挂载
│   ├── config.py               # 配置类，读取环境变量
│   ├── database.py             # SQLAlchemy 异步引擎 + session
│   ├── models/
│   │   ├── __init__.py
│   │   ├── community.py        # 小区表模型
│   │   ├── listing.py          # 挂牌房源表模型
│   │   ├── transaction.py      # 成交记录表模型
│   │   └── price_history.py    # 价格历史表模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── community.py        # 小区 Pydantic schema
│   │   ├── listing.py          # 房源 Pydantic schema
│   │   └── transaction.py      # 成交 Pydantic schema
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py           # 总路由，挂载子路由
│   │   ├── communities.py      # GET /api/communities, GET /api/communities/{id}, GET /api/communities/{id}/price-history, GET /api/communities/search
│   │   ├── listings.py         # GET /api/listings, GET /api/listings/{id}
│   │   ├── transactions.py     # GET /api/transactions, GET /api/transactions/stats
│   │   └── analysis.py         # GET /api/analysis/price-check, GET /api/analysis/compare
│   ├── services/
│   │   ├── __init__.py
│   │   └── price_analyzer.py   # 价格分析逻辑
│   └── utils/
│       ├── __init__.py
│       └── cache.py            # Redis 缓存装饰器
├── migrations/                 # Alembic
│   ├── env.py
│   └── versions/
├── alembic.ini
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 数据库模型详细定义

### communities 表
字段：
- id: Integer, 主键自增
- beike_id: String(32), 唯一索引
- name: String(200), 非空
- city: String(20), 默认"上海"
- district: String(50) -- 区
- sub_district: String(50) -- 板块/商圈
- address: String(300)
- build_year: Integer
- building_type: String(50) -- 塔楼/板楼/板塔结合
- total_units: Integer
- property_fee: Numeric(6,2) -- 物业费
- property_company: String(200)
- developer: String(200)
- green_rate: Numeric(4,2)
- parking_ratio: String(50)
- latitude: Numeric(10,7)
- longitude: Numeric(10,7)
- nearby_metro: JSONB -- [{name, line, distance_m}]
- nearby_schools: JSONB -- [{name, type, distance_m}]
- avg_unit_price: Numeric(10,2) -- 均价
- listing_count: Integer, 默认0
- source: String(20), 默认"beike"
- raw_data: JSONB
- created_at: DateTime, 默认now()
- updated_at: DateTime, 默认now()

### listings 表
字段：
- id: Integer, 主键
- beike_id: String(32), 唯一索引
- community_id: Integer, 外键 → communities.id
- title: String(300)
- total_price: Numeric(10,2) -- 万元
- unit_price: Numeric(10,2) -- 元/㎡
- area: Numeric(8,2)
- layout: String(50) -- 3室2厅1卫
- layout_rooms: Integer
- layout_halls: Integer
- floor_info: String(100)
- floor_number: Integer
- total_floors: Integer
- orientation: String(50)
- decoration: String(50)
- build_year: Integer
- elevator: Boolean
- listing_date: Date
- last_price_change: Numeric(10,2)
- price_change_date: Date
- is_unique: Boolean -- 唯一
- is_full_five: Boolean -- 满五
- has_mortgage: Boolean
- status: String(20), 默认"active" -- active/sold/removed
- images: JSONB
- source: String(20), 默认"beike"
- source_url: String(500)
- raw_data: JSONB
- created_at, updated_at: DateTime

### transactions 表
字段：
- id: Integer, 主键
- beike_id: String(32), 唯一索引
- community_id: Integer, 外键
- listing_id: Integer, 外键, 可空
- deal_price: Numeric(10,2) -- 成交价万元
- deal_unit_price: Numeric(10,2) -- 成交单价
- listing_price: Numeric(10,2) -- 挂牌价
- price_diff: Numeric(10,2) -- 差价
- deal_date: Date
- deal_cycle: Integer -- 成交周期天数
- area: Numeric(8,2)
- layout: String(50)
- floor_info: String(100)
- orientation: String(50)
- decoration: String(50)
- build_year: Integer
- source, source_url, raw_data, created_at: 同上

### price_history 表
字段：
- id: Integer, 主键
- community_id: Integer, 外键
- record_date: Date
- avg_unit_price: Numeric(10,2)
- listing_count: Integer
- deal_count: Integer
- avg_deal_price: Numeric(10,2)
- created_at: DateTime
- UNIQUE(community_id, record_date)

## API 路由

### communities.py
1. GET /api/communities
   查询参数：district, min_price, max_price, has_metro(bool), page(默认1), size(默认20)
   返回：分页列表，每项包含 id, name, district, sub_district, avg_unit_price, listing_count, build_year
   
2. GET /api/communities/search?q=关键词
   返回：匹配的小区列表（最多20个），用 name ILIKE '%q%'

3. GET /api/communities/{id}
   返回：小区完整详情

4. GET /api/communities/{id}/price-history?months=12
   返回：价格走势数组 [{date, avg_unit_price, listing_count, deal_count}]

### listings.py
1. GET /api/listings
   查询参数：community_id, min_price, max_price, min_area, max_area, rooms, status(默认active), sort(price_asc/price_desc/area_asc/area_desc/newest), page, size
   返回：分页列表

2. GET /api/listings/{id}
   返回：房源完整详情 + 所属小区名称

### transactions.py
1. GET /api/transactions
   查询参数：community_id, months(默认6), page, size
   返回：分页列表，按 deal_date DESC

2. GET /api/transactions/stats?community_id=123&months=12
   返回：{avg_deal_price, median_deal_price, avg_price_diff, avg_deal_cycle, total_count, price_trend: [{month, avg_price, count}]}

### analysis.py
1. GET /api/analysis/price-check?community_id=123&total_price=450&area=89
   逻辑：
   - 查该小区近6个月同面积段(±20%)成交记录
   - 计算用户输入的单价在成交价分布中的百分位
   - 返回：{input_unit_price, avg_deal_unit_price, percentile, verdict: "偏低"/"合理"/"偏高"/"明显偏高", similar_deals: [...最近3条类似成交]}

## 其他要求

1. docker-compose.yml 包含：
   - fastapi-app (端口8000)
   - postgres (端口5432)
   - redis (端口6379)
   所有服务在同一 network

2. requirements.txt 包含：
   fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, redis, pydantic, pydantic-settings, python-dotenv

3. .env.example：
   DATABASE_URL=postgresql+asyncpg://fasthousing:fasthousing@localhost:5432/fasthousing
   REDIS_URL=redis://localhost:6379/0
   CORS_ORIGINS=http://localhost:3000,http://localhost:3456

4. main.py 配置 CORS，挂载 /api 路由前缀

5. 所有 API 支持 JSON 响应，统一错误格式：{"detail": "错误信息"}

6. 缓存策略：小区列表缓存 5 分钟，小区详情缓存 1 小时，价格历史缓存 1 小时
```

---

## Prompt 2: Alembic 数据库迁移

```
在 fasthousing-backend 项目中配置 Alembic 数据库迁移：

1. 初始化 Alembic：alembic init migrations
2. 修改 alembic.ini 和 migrations/env.py 以支持异步 SQLAlchemy
3. 创建初始迁移文件，包含 communities, listings, transactions, price_history 四张表
4. 添加所有索引

确保 env.py 从 app.config 读取 DATABASE_URL，并正确导入所有 models。

迁移命令：
- alembic upgrade head  # 创建表
- alembic revision --autogenerate -m "描述"  # 生成迁移
```

---

## Prompt 3: 贝壳爬虫

```
在 fasthousing-backend 项目中创建贝壳上海房产数据爬虫。

## 项目结构
```
crawler/
├── __init__.py
├── config.py               # 爬虫配置（代理、限速、城市等）
├── base_spider.py           # 基础爬虫类（请求、解析、反反爬）
├── community_spider.py      # 小区爬虫
├── listing_spider.py        # 在售房源爬虫
├── transaction_spider.py    # 成交记录爬虫
├── pipeline.py              # 数据清洗 + 入库
├── proxy_pool.py            # 代理池管理
├── scheduler.py             # 定时任务（APScheduler）
├── run.py                   # 手动运行入口
└── requirements.txt         # 爬虫额外依赖
```

## 技术选型
- 不用 Scrapy（太重），用 httpx（异步HTTP）+ BeautifulSoup/parsel（解析）
- 异步爬取，控制并发数
- 用 asyncio.Semaphore 限制并发（最多5个同时请求）

## base_spider.py
```python
class BaseSpider:
    """基础爬虫，封装请求和反反爬逻辑"""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30)
        self.semaphore = asyncio.Semaphore(5)  # 并发控制
        self.request_count = 0
        self.ua_pool = [...]  # 10-20个常见 User-Agent
    
    async def fetch(self, url: str) -> str:
        """带反爬策略的请求"""
        async with self.semaphore:
            await asyncio.sleep(random.uniform(2, 5))  # 随机延迟
            headers = {
                "User-Agent": random.choice(self.ua_pool),
                "Accept": "text/html,...",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": "https://sh.ke.com/",
            }
            # 可选：代理
            response = await self.client.get(url, headers=headers)
            self.request_count += 1
            
            if response.status_code == 403 or "验证" in response.text:
                raise AntiCrawlError("被反爬拦截")
            
            return response.text
    
    def parse_page_count(self, html: str) -> int:
        """解析总页数"""
        ...
```

## community_spider.py
爬取入口：https://sh.ke.com/xiaoqu/
- 按区遍历：浦东、黄浦、徐汇、长宁、静安、普陀、虹口、杨浦、闵行、宝山、嘉定、松江、青浦、奉贤、金山、崇明
- 每个区按分页遍历所有小区
- 解析字段：小区名、beike_id（从URL提取）、均价、在售数量、建成年代、地址、区域
- 存入 communities 表（UPSERT by beike_id）

上海各区的 URL 路径：
```python
SHANGHAI_DISTRICTS = {
    "浦东": "pudong",
    "黄浦": "huangpu", 
    "徐汇": "xuhui",
    "长宁": "changning",
    "静安": "jingan",
    "普陀": "putuo",
    "虹口": "hongkou",
    "杨浦": "yangpu",
    "闵行": "minhang",
    "宝山": "baoshan",
    "嘉定": "jiading",
    "松江": "songjiang",
    "青浦": "qingpu",
    "奉贤": "fengxian",
    "金山": "jinshan",
    "崇明": "chongming",
}
```

列表页 URL 格式：https://sh.ke.com/xiaoqu/{district}/pg{page}/

解析小区列表：
- 每个小区卡片在 `.xiaoquListItem` 里
- 小区名：`.maidian-detail .title a` 的 text
- beike_id：从链接 href 提取 `/xiaoqu/(\d+)/`
- 均价：`.xiaoquListItemPrice .totalPrice span` 的 text（元/㎡）
- 在售：`.xiaoquListItemSellCount .totalSellCount span`
- 地址/年代等在 `.positionInfo` 里

## listing_spider.py
- 输入：community_id 列表（从数据库获取）
- 对每个小区，爬取 https://sh.ke.com/ershoufang/c{beike_id}/
- 分页遍历
- 解析房源：标题、总价、单价、面积、户型、楼层、朝向、装修等
- 存入 listings 表（UPSERT by beike_id）

## transaction_spider.py
- 输入：community_id 列表
- 对每个小区，爬取 https://sh.ke.com/chengjiao/c{beike_id}/
- 解析成交记录：成交价、成交日期、面积、户型等
- 挂牌价通常在详情页，可选择是否爬取详情
- 存入 transactions 表

## pipeline.py
数据清洗逻辑：
```python
def clean_price(price_str: str) -> float:
    """'450万' → 450.0, '4.5万/㎡' → 45000"""
    
def clean_area(area_str: str) -> float:
    """'89.3㎡' → 89.3"""
    
def clean_layout(layout_str: str) -> tuple:
    """'3室2厅1卫' → (3, 2, 1)"""
    
def clean_floor(floor_str: str) -> dict:
    """'中楼层(共18层)' → {floor_number: None, total_floors: 18, level: '中'}"""

def clean_date(date_str: str) -> date:
    """'2025.03.15' → date(2025, 3, 15)"""
```

## scheduler.py
使用 APScheduler：
- 每天凌晨 2:00：运行 listing_spider（增量）
- 每天凌晨 4:00：运行 transaction_spider（增量）
- 每周日凌晨 1:00：运行 community_spider（更新小区信息）
- 每天 6:00：聚合生成 price_history 快照

## run.py
手动运行入口：
```python
# python -m crawler.run --type community    # 爬小区
# python -m crawler.run --type listing      # 爬房源
# python -m crawler.run --type transaction  # 爬成交
# python -m crawler.run --type all          # 全量
# python -m crawler.run --type daily        # 日常增量
```

## 注意事项
- 所有爬虫先实现基础功能，贝壳页面结构可能变动，写好异常处理
- 每个 spider 都要有进度日志（已爬取数量、错误数量、耗时）
- 爬虫可以先不接代理，用本地 IP 测试，正式跑的时候再配代理
- 先写好框架和数据流，实际选择器可能需要根据当前贝壳页面调整
```

---

## Prompt 4: 前端对接后端 API

```
FastHousing 前端项目需要对接后端 API，做以下改造：

## 1. API 客户端

新建 src/lib/api.ts：

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchAPI<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// 小区搜索
export async function searchCommunities(q: string) { ... }

// 小区详情
export async function getCommunity(id: number) { ... }

// 小区价格历史
export async function getCommunityPriceHistory(id: number, months?: number) { ... }

// 房源列表
export async function getListings(params: ListingQuery) { ... }

// 成交记录
export async function getTransactions(communityId: number, months?: number) { ... }

// 成交统计
export async function getTransactionStats(communityId: number) { ... }

// 价格评估
export async function checkPrice(communityId: number, totalPrice: number, area: number) { ... }
```

## 2. 房源对比器增加"从数据库导入"

在 /compare 页面添加一个新按钮"从数据库搜索"（和"添加房源"并排）。

点击后弹出搜索面板：
- 搜索框：输入小区名，调用 searchCommunities API
- 搜索结果列表：显示匹配的小区，点击展开该小区在售房源
- 房源列表：每条显示基本信息 + "导入"按钮
- 点击"导入"：将 API 数据转换为 HouseItem 格式，添加到本地对比列表
- 评分字段（floorScore 等）设置默认值 3，用户可后续手动调整

## 3. 新建「价格透视镜」页面 /price

新页面 src/app/price/page.tsx：

页面布局：
1. 顶部搜索框：输入小区名，搜索并选择
2. 选中小区后显示：
   a. 小区基本信息卡片（名称、均价、在售数量、建成年代）
   b. 价格走势折线图（Recharts LineChart，X轴月份，Y轴均价）
   c. 近期成交记录列表（表格：成交价、面积、户型、日期、挂牌价、价差）
   d. 挂牌价 vs 成交价 差距分析（柱状图或统计卡片）
   e. 成交统计：平均成交价、平均成交周期、成交量趋势

3. 底部导航增加"透视"tab（📈 图标），5个tab

## 4. 环境变量

在 .env.local 中添加：
NEXT_PUBLIC_API_URL=http://localhost:8000/api

在 next.config.ts 中无需额外配置（NEXT_PUBLIC_ 前缀自动暴露给浏览器）。
```
