"""CloudWatch, logs, and monitoring stack."""

import aws_cdk as cdk
from aws_cdk import aws_logs as logs, aws_budgets as budgets
from constructs import Construct

# The pipeline module introduces the app's first real variable cost (Bedrock).
# Blueprint calls a cost guardrail non-negotiable once that's true.
BUDGET_ALERT_EMAIL = "rishabedmund13@gmail.com"
BUDGET_LIMIT_USD = 50


class ObservabilityStack(cdk.Stack):
    """Manages CloudWatch logs, alarms, and dashboards."""

    def __init__(self, scope: Construct, id: str, env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.env_name = env_name

        # Log group for Lambda functions
        self.lambda_log_group = logs.LogGroup(
            self,
            "LambdaLogs",
            log_group_name=f"/aws/lambda/jobhunter-{env_name}",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        cdk.CfnOutput(
            self,
            "LogGroupName",
            value=self.lambda_log_group.log_group_name,
        )

        def _notification(
            threshold_pct: float,
        ) -> budgets.CfnBudget.NotificationWithSubscribersProperty:
            return budgets.CfnBudget.NotificationWithSubscribersProperty(
                notification=budgets.CfnBudget.NotificationProperty(
                    notification_type="ACTUAL",
                    comparison_operator="GREATER_THAN",
                    threshold=threshold_pct,
                    threshold_type="PERCENTAGE",
                ),
                subscribers=[
                    budgets.CfnBudget.SubscriberProperty(
                        subscription_type="EMAIL", address=BUDGET_ALERT_EMAIL
                    )
                ],
            )

        budgets.CfnBudget(
            self,
            "MonthlyCostBudget",
            budget=budgets.CfnBudget.BudgetDataProperty(
                budget_type="COST",
                time_unit="MONTHLY",
                budget_limit=budgets.CfnBudget.SpendProperty(amount=BUDGET_LIMIT_USD, unit="USD"),
                budget_name=f"jobhunter-{env_name}-monthly",
            ),
            notifications_with_subscribers=[_notification(50), _notification(100)],
        )
