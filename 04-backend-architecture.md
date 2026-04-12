# FastHousing — 后端架构 & 数据库设计

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| **后端框架** | Python FastAPI | 异步高性能，爬虫生态好（Scrapy/requests），类型提示完善 |
| **数据库** | PostgreSQL 15+ | 支持 JSON 字段、全文搜索、地理查询，免费稳定 |
| **ORM** | SQLAlchemy 2.0 + Alembic | 成熟的异步支持 + 数据库迁移 |
| **缓存** | Redis | 热数据缓存、爬虫去重、限流 |
| **爬虫** | Scrapy + Playwright | Scrapy 做主力，Playwright 处理 JS 渲染页面 |
| **定时任务** | APScheduler / Celery Beat | 定时增量爬取 |
| **部署** | Docker Compose | 一键启动 FastAPI + PostgreSQL + Redis |

---

## 项目结构

```
fasthousing-backend/
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置（数据库URL、Redis、API密钥）
│   ├── database.py             # 数据库连接
│   ├── models/                 # SQLAlchemy 模型
│   │   ├── __init__.py
│   │   ├── community.py        # 小区
│   │   ├── listing.py          # 挂牌房源
│   │   ├── transaction.py      # 成交记录
│   │   └── price_history.py    # 价格历史
│   ├── schemas/                # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── community.py
│   │   ├── listing.py
│   │   └── transaction.py
│   ├── api/                    # API 路由
│   │   ├── __init__.py
│   │   ├── communities.py      # 小区相关接口
│   │   ├── listings.py         # 房源相关接口
│   │   ├── transactions.py     # 成交相关接口
│   │   └── analysis.py         # 分析相关接口
│   ├── services/               # 业务逻辑
│   │   ├── price_analyzer.py   # 价格分析
│   │   └── recommendation.py   # 推荐引擎
│   └── utils/
│       └── cache.py            # Redis 缓存封装
├── crawler/
│   ├── scrapy.cfg
│   ├── beike/                  # 贝壳爬虫
│   │   ├── settings.py
│   │   ├── items.py
│   │   ├── pipelines.py        # 数据清洗 + 入库
│   │   ├── middlewares.py      # 反反爬中间件
│   │   └── spiders/
│   │       ├── community.py    # 小区列表爬虫
│   │       ├── listing.py      # 挂牌房源爬虫
│   │       └── transaction.py  # 成交记录爬虫
│   └── scheduler.py            # 定时任务调度
├── migrations/                 # Alembic 数据库迁移
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## 数据库设计

### 表1: communities（小区）

```sql
CREATE TABLE communities (
    id SERIAL PRIMARY KEY,
    beike_id VARCHAR(32) UNIQUE,           -- 贝壳小区ID
    name VARCHAR(200) NOT NULL,             -- 小区名称
    city VARCHAR(20) DEFAULT '上海',
    district VARCHAR(50),                   -- 区（如浦东新区）
    sub_district VARCHAR(50),               -- 商圈/板块（如陆家嘴）
    address VARCHAR(300),                   -- 详细地址
    build_year INTEGER,                     -- 建成年代
    building_type VARCHAR(50),              -- 建筑类型（塔楼/板楼/板塔结合）
    total_units INTEGER,                    -- 总户数
    property_fee DECIMAL(6,2),              -- 物业费（元/㎡/月）
    property_company VARCHAR(200),          -- 物业公司
    developer VARCHAR(200),                 -- 开发商
    green_rate DECIMAL(4,2),                -- 绿化率
    parking_ratio VARCHAR(50),              -- 车位比
    
    -- 地理位置
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    
    -- 周边配套（JSON）
    nearby_metro JSONB,                     -- [{name, line, distance_m}]
    nearby_schools JSONB,                   -- [{name, type, distance_m}]
    
    -- 价格概览
    avg_unit_price DECIMAL(10,2),           -- 均价（元/㎡），定期更新
    listing_count INTEGER DEFAULT 0,        -- 在售房源数
    
    -- 元数据
    source VARCHAR(20) DEFAULT 'beike',
    raw_data JSONB,                         -- 原始爬取数据
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 索引
    CONSTRAINT idx_community_district UNIQUE (city, district, name)
);

CREATE INDEX idx_community_geo ON communities USING GIST (
    ST_MakePoint(longitude, latitude)
);  -- 需要 PostGIS 扩展，可选
CREATE INDEX idx_community_district_search ON communities (city, district);
CREATE INDEX idx_community_price ON communities (avg_unit_price);
```

### 表2: listings（挂牌房源）

```sql
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    beike_id VARCHAR(32) UNIQUE,            -- 贝壳房源ID
    community_id INTEGER REFERENCES communities(id),
    
    -- 基本信息
    title VARCHAR(300),                     -- 标题
    total_price DECIMAL(10,2),              -- 总价（万元）
    unit_price DECIMAL(10,2),               -- 单价（元/㎡）
    area DECIMAL(8,2),                      -- 面积（㎡）
    layout VARCHAR(50),                     -- 户型（3室2厅1卫）
    layout_rooms INTEGER,                   -- 几室
    layout_halls INTEGER,                   -- 几厅
    
    -- 房屋属性
    floor_info VARCHAR(100),                -- 楼层描述
    floor_number INTEGER,                   -- 具体楼层
    total_floors INTEGER,                   -- 总楼层
    orientation VARCHAR(50),                -- 朝向
    decoration VARCHAR(50),                 -- 装修状况
    build_year INTEGER,                     -- 建筑年代
    building_type VARCHAR(50),              -- 建筑类型
    elevator BOOLEAN,                       -- 有无电梯
    
    -- 交易属性
    listing_date DATE,                      -- 挂牌时间
    last_price_change DECIMAL(10,2),        -- 上次调价金额
    price_change_date DATE,                 -- 调价日期
    ownership_type VARCHAR(50),             -- 产权性质
    ownership_years VARCHAR(20),            -- 产权年限
    is_unique BOOLEAN,                      -- 是否唯一
    is_full_five BOOLEAN,                   -- 是否满五年
    has_mortgage BOOLEAN,                   -- 是否有抵押
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',    -- active/sold/removed
    
    -- 图片
    images JSONB,                           -- [url1, url2, ...]
    vr_url VARCHAR(500),                    -- VR看房链接
    
    -- 元数据
    source VARCHAR(20) DEFAULT 'beike',
    source_url VARCHAR(500),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listing_community ON listings (community_id);
CREATE INDEX idx_listing_price ON listings (total_price);
CREATE INDEX idx_listing_area ON listings (area);
CREATE INDEX idx_listing_status ON listings (status);
CREATE INDEX idx_listing_district ON listings (community_id, status, total_price);
```

### 表3: transactions（成交记录）

```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    beike_id VARCHAR(32) UNIQUE,
    community_id INTEGER REFERENCES communities(id),
    listing_id INTEGER REFERENCES listings(id),  -- 可能关联挂牌记录
    
    -- 成交信息
    deal_price DECIMAL(10,2),               -- 成交总价（万元）
    deal_unit_price DECIMAL(10,2),          -- 成交单价（元/㎡）
    listing_price DECIMAL(10,2),            -- 挂牌价（万元）
    price_diff DECIMAL(10,2),               -- 价差（万元）= 成交价 - 挂牌价
    deal_date DATE,                         -- 成交日期
    deal_cycle INTEGER,                     -- 成交周期（天）
    
    -- 房屋信息
    area DECIMAL(8,2),
    layout VARCHAR(50),
    floor_info VARCHAR(100),
    orientation VARCHAR(50),
    decoration VARCHAR(50),
    build_year INTEGER,
    
    -- 元数据
    source VARCHAR(20) DEFAULT 'beike',
    source_url VARCHAR(500),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transaction_community ON transactions (community_id);
CREATE INDEX idx_transaction_date ON transactions (deal_date DESC);
CREATE INDEX idx_transaction_price ON transactions (deal_unit_price);
```

### 表4: price_history（价格历史快照）

```sql
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    community_id INTEGER REFERENCES communities(id),
    
    record_date DATE NOT NULL,
    avg_unit_price DECIMAL(10,2),           -- 均价
    listing_count INTEGER,                  -- 在售数量
    deal_count INTEGER,                     -- 当月成交量
    avg_deal_price DECIMAL(10,2),           -- 平均成交单价
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (community_id, record_date)
);

CREATE INDEX idx_price_history_date ON price_history (community_id, record_date DESC);
```

---

## API 设计

### 小区相关

```
GET  /api/communities
     ?district=浦东新区
     &min_price=30000&max_price=80000
     &has_metro=true
     &page=1&size=20
     → 返回小区列表（支持筛选、分页）

GET  /api/communities/{id}
     → 返回小区详情（含周边配套、价格概览）

GET  /api/communities/{id}/price-history
     ?months=12
     → 返回该小区价格走势数据

GET  /api/communities/search
     ?q=中远两湾城
     → 小区名称模糊搜索
```

### 房源相关

```
GET  /api/listings
     ?community_id=123
     &min_price=300&max_price=500
     &min_area=80&max_area=120
     &rooms=3
     &status=active
     &sort=price_asc
     &page=1&size=20
     → 返回房源列表（多条件筛选）

GET  /api/listings/{id}
     → 返回房源详情
```

### 成交相关

```
GET  /api/transactions
     ?community_id=123
     &months=6
     &page=1&size=20
     → 返回成交记录列表

GET  /api/transactions/stats
     ?community_id=123
     &months=12
     → 返回统计数据：平均成交价、挂牌价差、成交周期等
```

### 分析相关

```
GET  /api/analysis/price-check
     ?community_id=123
     &total_price=450
     &area=89
     → 返回价格评估：该房源价格在同小区处于什么位置（偏贵/合理/偏低）

GET  /api/analysis/compare
     ?listing_ids=1,2,3
     → 返回多房源对比分析（自动补充成交数据）
```

---

## 前后端对接要点

### 前端改造

当后端 API 就绪后，前端需要改造的地方：

1. **房源对比器**：添加"从数据库导入"功能
   - 搜索小区名 → 展示在售房源列表 → 一键导入到对比器
   - 保留手动输入作为备选

2. **价格透视镜**（新页面）：
   - 输入小区名 → 展示历史成交价走势图
   - 显示挂牌价 vs 成交价差距
   - 显示当前在售房源分布

3. **交易 Checklist**：
   - 在"看房选房"阶段集成房源搜索
   - 在"谈价签约"阶段展示同小区近期成交价参考

### CORS 配置

```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://fasthousing.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 环境变量

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/fasthousing
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,https://fasthousing.vercel.app
```
