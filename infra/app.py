#!/usr/bin/env python3
"""JobHunter CDK application."""

import aws_cdk as cdk
from stacks.auth import AuthStack
from stacks.data import DataStack
from stacks.api import ApiStack
from stacks.pipeline import PipelineStack
from stacks.web import WebStack
from stacks.observability import ObservabilityStack

app = cdk.App()

env_name = app.node.try_get_context("env") or "dev"
account = app.node.try_get_context("account")
region = app.node.try_get_context("region")

env = cdk.Environment(account=account, region=region)

# Stacks in dependency order
auth = AuthStack(app, f"jobhunter-auth-{env_name}", env=env, env_name=env_name)
data = DataStack(app, f"jobhunter-data-{env_name}", env=env, env_name=env_name)
api = ApiStack(
    app, f"jobhunter-api-{env_name}", env=env, env_name=env_name, auth_stack=auth, data_stack=data
)
pipeline = PipelineStack(
    app, f"jobhunter-pipeline-{env_name}", env=env, env_name=env_name, data_stack=data
)
web = WebStack(app, f"jobhunter-web-{env_name}", env=env, env_name=env_name, api_stack=api)
obs = ObservabilityStack(app, f"jobhunter-obs-{env_name}", env=env, env_name=env_name)

app.synth()
