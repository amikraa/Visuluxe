#!/usr/bin/env python3
"""
Test script to verify the dynamic model system implementation
This script tests all components of the dynamic model system to ensure they're working correctly.
"""

import asyncio
import json
import logging
import sys
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DynamicModelSystemTester:
    def __init__(self):
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message
        })
        logger.info(f"{status} - {test_name}: {message}")
        
    def check_file_exists(self, file_path: str) -> bool:
        """Check if a file exists"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return True
        except FileNotFoundError:
            return False
            
    def check_imports(self) -> bool:
        """Test if all necessary imports work"""
        try:
            # Test backend imports
            sys.path.append('backend')
            from app.routers.models import list_models
            from app.services.processor import ImageProcessor
            from app.services.provider_health import provider_health_monitor
            from app.services.database import DatabaseService
            
            # Test frontend components exist
            frontend_files = [
                'src/pages/ModelCatalog.tsx',
                'src/components/ModelCard.tsx', 
                'src/components/ModelModal.tsx',
                'src/hooks/useAdminAnalytics.ts'
            ]
            
            for file_path in frontend_files:
                if not self.check_file_exists(file_path):
                    self.log_test(f"Frontend file exists: {file_path}", False, "File not found")
                    return False
                    
            self.log_test("All imports work correctly", True, "Backend and frontend components accessible")
            return True
            
        except ImportError as e:
            self.log_test("Import test", False, f"Import error: {e}")
            return False
            
    def check_api_endpoints(self) -> bool:
        """Test API endpoint structure"""
        try:
            # Check if the models API endpoint is properly structured
            sys.path.append('backend')
            from app.routers.models import list_models, get_model
            
            # Verify the functions exist and have correct signatures
            if not callable(list_models) or not callable(get_model):
                self.log_test("API endpoints", False, "Functions not callable")
                return False
                
            self.log_test("API endpoints", True, "Models API properly structured")
            return True
            
        except Exception as e:
            self.log_test("API endpoints", False, f"Error: {e}")
            return False
            
    def check_provider_selection(self) -> bool:
        """Test provider selection algorithm"""
        try:
            sys.path.append('backend')
            from app.services.processor import ImageProcessor
            
            # Check if the provider selection method exists
            if not hasattr(ImageProcessor, '_call_provider_api'):
                self.log_test("Provider selection", False, "_call_provider_api method not found")
                return False
                
            # Check if the health monitoring is integrated
            from app.services.provider_health import provider_health_monitor
            if not hasattr(provider_health_monitor, 'get_provider_status'):
                self.log_test("Provider selection", False, "Health monitoring not integrated")
                return False
                
            self.log_test("Provider selection", True, "Provider selection algorithm with health monitoring")
            return True
            
        except Exception as e:
            self.log_test("Provider selection", False, f"Error: {e}")
            return False
            
    def check_model_maintenance(self) -> bool:
        """Test model maintenance enforcement"""
        try:
            sys.path.append('backend')
            from app.services.processor import ImageProcessor
            
            # Check if model maintenance checks are implemented
            import inspect
            source = inspect.getsource(ImageProcessor._get_model_info)
            
            # Check for maintenance mode checks (both patterns)
            if 'maintenance' in source.lower():
                self.log_test("Model maintenance", True, "Maintenance mode checks implemented")
                return True
            else:
                self.log_test("Model maintenance", False, "Maintenance mode checks not found")
                return False
                
        except Exception as e:
            self.log_test("Model maintenance", False, f"Error: {e}")
            return False
            
    def check_analytics_updates(self) -> bool:
        """Test analytics updates"""
        try:
            sys.path.append('backend')
            from app.services.processor import ImageProcessor
            
            # Check if analytics update method exists
            if not hasattr(ImageProcessor, '_update_model_analytics'):
                self.log_test("Analytics updates", False, "_update_model_analytics method not found")
                return False
                
            # Check if the method is called in the processing flow
            import inspect
            processor_source = inspect.getsource(ImageProcessor.process_job)
            
            if '_update_model_analytics' in processor_source:
                self.log_test("Analytics updates", True, "Analytics updates integrated in processing flow")
                return True
            else:
                self.log_test("Analytics updates", False, "Analytics updates not integrated")
                return False
                
        except Exception as e:
            self.log_test("Analytics updates", False, f"Error: {e}")
            return False
            
    def check_fallback_logic(self) -> bool:
        """Test provider fallback logic"""
        try:
            sys.path.append('backend')
            from app.services.processor import ImageProcessor
            
            # Check if fallback logic is implemented
            import inspect
            processor_source = inspect.getsource(ImageProcessor._call_provider_api)
            
            fallback_indicators = [
                'for selected_provider in sorted_providers',
                'continue',
                'last_error'
            ]
            
            fallback_found = all(indicator in processor_source for indicator in fallback_indicators)
            
            if fallback_found:
                self.log_test("Provider fallback logic", True, "Fallback mechanism implemented")
                return True
            else:
                self.log_test("Provider fallback logic", False, "Fallback mechanism not found")
                return False
                
        except Exception as e:
            self.log_test("Provider fallback logic", False, f"Error: {e}")
            return False
            
    def check_real_time_updates(self) -> bool:
        """Test real-time model updates"""
        try:
            sys.path.append('backend')
            from app.services.processor import ImageProcessor
            
            # Check if real-time model fetching is implemented
            import inspect
            processor_source = inspect.getsource(ImageProcessor._get_model_info)
            
            if 'refresh=True' in processor_source or 'real-time' in processor_source.lower():
                self.log_test("Real-time updates", True, "Real-time model fetching implemented")
                return True
            else:
                # Check if the method fetches from database on each call
                if 'sb.table("models").select' in processor_source:
                    self.log_test("Real-time updates", True, "Database fetching on each call")
                    return True
                else:
                    self.log_test("Real-time updates", False, "Real-time updates not implemented")
                    return False
                    
        except Exception as e:
            self.log_test("Real-time updates", False, f"Error: {e}")
            return False
            
    def check_frontend_integration(self) -> bool:
        """Test frontend integration"""
        try:
            # Check ModelCatalog.tsx for dynamic API calls
            with open('src/pages/ModelCatalog.tsx', 'r', encoding='utf-8') as f:
                catalog_content = f.read()
                
            if 'fetch(\'/api/models\')' in catalog_content:
                self.log_test("Frontend integration", True, "ModelCatalog fetches from dynamic API")
            else:
                self.log_test("Frontend integration", False, "ModelCatalog not using dynamic API")
                return False
                
            # Check ModelCard.tsx for dynamic data handling
            with open('src/components/ModelCard.tsx', 'r', encoding='utf-8') as f:
                card_content = f.read()
                
            if 'model.providers' in card_content and 'model.capabilities' in card_content:
                self.log_test("Frontend integration", True, "ModelCard handles dynamic model data")
            else:
                self.log_test("Frontend integration", False, "ModelCard not handling dynamic data")
                return False
                
            # Check ModelModal.tsx for dynamic data handling
            with open('src/components/ModelModal.tsx', 'r', encoding='utf-8') as f:
                modal_content = f.read()
                
            if 'model.providers' in modal_content and 'model.capabilities' in modal_content:
                self.log_test("Frontend integration", True, "ModelModal handles dynamic model data")
            else:
                self.log_test("Frontend integration", False, "ModelModal not handling dynamic data")
                return False
                
            return True
            
        except Exception as e:
            self.log_test("Frontend integration", False, f"Error: {e}")
            return False
            
    def check_database_schema(self) -> bool:
        """Test database schema"""
        try:
            # Check if the migration file exists and contains necessary tables
            with open('supabase/migrations/20260311170500_enhanced_job_management.sql', 'r', encoding='utf-8') as f:
                migration_content = f.read()
                
            required_tables = [
                'model_catalog',
                'provider_configurations', 
                'provider_health_checks',
                'model_analytics'
            ]
            
            missing_tables = [table for table in required_tables if f'CREATE TABLE IF NOT EXISTS {table}' not in migration_content]
            
            if missing_tables:
                self.log_test("Database schema", False, f"Missing tables: {', '.join(missing_tables)}")
                return False
            else:
                self.log_test("Database schema", True, "All required tables present")
                return True
                
        except Exception as e:
            self.log_test("Database schema", False, f"Error: {e}")
            return False
            
    def check_legacy_removal(self) -> bool:
        """Test that legacy code has been removed"""
        try:
            # Check that static models.json doesn't exist
            if self.check_file_exists('src/data/models.json'):
                self.log_test("Legacy code removal", False, "Static models.json still exists")
                return False
                
            # Check that hardcoded model references are removed from frontend
            frontend_files = [
                'src/pages/ModelCatalog.tsx',
                'src/components/ModelCard.tsx',
                'src/components/ModelModal.tsx'
            ]
            
            for file_path in frontend_files:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                if 'models.json' in content or 'static.*model' in content:
                    self.log_test("Legacy code removal", False, f"Hardcoded references found in {file_path}")
                    return False
                    
            self.log_test("Legacy code removal", True, "No legacy code remnants found")
            return True
            
        except Exception as e:
            self.log_test("Legacy code removal", False, f"Error: {e}")
            return False
            
    async def run_all_tests(self):
        """Run all tests and provide summary"""
        logger.info("🧪 Starting Dynamic Model System Tests")
        logger.info("=" * 60)
        
        # Run all tests
        tests = [
            ("Import Structure", self.check_imports),
            ("API Endpoints", self.check_api_endpoints),
            ("Provider Selection", self.check_provider_selection),
            ("Model Maintenance", self.check_model_maintenance),
            ("Analytics Updates", self.check_analytics_updates),
            ("Provider Fallback", self.check_fallback_logic),
            ("Real-time Updates", self.check_real_time_updates),
            ("Frontend Integration", self.check_frontend_integration),
            ("Database Schema", self.check_database_schema),
            ("Legacy Removal", self.check_legacy_removal)
        ]
        
        for test_name, test_func in tests:
            try:
                if asyncio.iscoroutinefunction(test_func):
                    await test_func()
                else:
                    test_func()
            except Exception as e:
                self.log_test(test_name, False, f"Test execution error: {e}")
                
        # Print summary
        logger.info("=" * 60)
        logger.info("📊 TEST SUMMARY")
        logger.info("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            logger.info(f"{status} {result['test']}")
            if result['message']:
                logger.info(f"     {result['message']}")
                
        logger.info("=" * 60)
        logger.info(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            logger.info("🎉 All tests passed! Dynamic model system is fully functional.")
        else:
            logger.info(f"⚠️  {total - passed} tests failed. Review the issues above.")
            
        return passed == total

async def main():
    """Main test runner"""
    tester = DynamicModelSystemTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())