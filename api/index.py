import sys
import os

# Add project root to sys.path for Vercel Serverless Function execution
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
