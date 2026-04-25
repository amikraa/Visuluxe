"""
Null Object Pattern for Supabase client.
Returns safe empty responses when real Supabase client is unavailable.
All .table() chains return safe empty results - no crashes in degraded mode.
"""


class NullQueryResult:
    """Empty query result mimicking Supabase response.data"""
    data = []
    count = 0
    
    def execute(self):
        return self


class NullQueryBuilder:
    """Null object for query builder chain - all methods return self for chaining, execute() returns empty."""
    
    def select(self, *args, **kwargs):
        return self
    
    def insert(self, *args, **kwargs):
        return NullQueryResult()
    
    def update(self, *args, **kwargs):
        return NullQueryResult()
    
    def delete(self):
        return NullQueryResult()
    
    def upsert(self, *args, **kwargs):
        return NullQueryResult()
    
    def execute(self):
        return NullQueryResult()
    
    def eq(self, *args, **kwargs):
        return self
    
    def in_(self, *args, **kwargs):
        return self
    
    def gte(self, *args, **kwargs):
        return self
    
    def lte(self, *args, **kwargs):
        return self
    
    def lt(self, *args, **kwargs):
        return self
    
    def gt(self, *args, **kwargs):
        return self
    
    def ne(self, *args, **kwargs):
        return self
    
    def like(self, *args, **kwargs):
        return self
    
    def ilike(self, *args, **kwargs):
        return self
    
    def or_(self, *args, **kwargs):
        return self
    
    def and_(self, *args, **kwargs):
        return self
    
    def not_(self, *args, **kwargs):
        return self
    
    def is_(self, *args, **kwargs):
        return self
    
    def order(self, *args, **kwargs):
        return self
    
    def limit(self, *args, **kwargs):
        return self
    
    def range(self, *args, **kwargs):
        return self
    
    def single(self):
        return NullQueryResult()
    
    def maybe_single(self):
        return NullQueryResult()


class NullSupabase:
    """Null object for Supabase client - all table operations return safe empty results."""
    def table(self, *args, **kwargs):
        return NullQueryBuilder()
    
    def auth(self):
        return NullAuth()


class NullAuth:
    def get_user(self, *args, **kwargs):
        class Result:
            user = None
        return Result()


# Singleton
_null_supabase = NullSupabase()


def get_safe_supabase():
    return _null_supabase
