from crawler.base_spider import BaseSpider

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


class CommunitySpider(BaseSpider):
    async def crawl(self) -> list[dict]:
        # TODO: parse community list pages and return normalized rows.
        return []
