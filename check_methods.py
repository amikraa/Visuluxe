import sys
import os
sys.path.append('backend')
from app.services.database import DatabaseService
import inspect

methods = [method for method in dir(DatabaseService) if not method.startswith('_')]
print('DatabaseService methods:')
for method in methods:
    print(f'  {method}')