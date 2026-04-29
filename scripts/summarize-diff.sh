#!/bin/bash

# Run CDK diff and capture output and exit status
CDK_DIFF_OUTPUT=$(npm run cdk diff 2>&1)
CDK_EXIT_CODE=$?

# Create summary by extracting key information
SUMMARY="CDK Diff Summary"
if [[ -z "$CDK_DIFF_OUTPUT" ]]; then
    SUMMARY="No CDK changes detected"
else
    # Check if CDK diff failed
    if [[ $CDK_EXIT_CODE -ne 0 ]]; then
        SUMMARY="❌ Error running CDK diff"
    else
        # Check for the summary line that shows number of stacks with differences
        STACK_SUMMARY=$(echo "$CDK_DIFF_OUTPUT" | grep "Number of stacks with differences:" | awk '{print $NF}' || echo "0")
        
        # Use the summary count as it's the most accurate
        STACK_COUNT=$STACK_SUMMARY
        
        # Count resource changes more accurately
        # Look for lines with resource change indicators: [+], [-], or [~]
        RESOURCE_CHANGES=$(echo "$CDK_DIFF_OUTPUT" | grep -E "^[[:space:]]+\[[+~\-]\]" | wc -l || true)
        
        if [[ $STACK_COUNT -gt 0 ]]; then
            if [[ $RESOURCE_CHANGES -gt 0 ]]; then
                SUMMARY="✅ CDK changes detected in $STACK_COUNT stack(s) with $RESOURCE_CHANGES resource changes"
            else
                SUMMARY="✅ CDK changes detected in $STACK_COUNT stack(s) with resource changes"
            fi
        else
            SUMMARY="✅ No changes detected"
        fi
    fi
fi

# For GitHub Actions, we need to handle multi-line output differently
# Use GitHub's multi-line string syntax with proper escaping
CDK_DIFF_OUTPUT_ESCAPED=$(echo "$CDK_DIFF_OUTPUT" | sed 's/%/%25/g; s/\n/%0A/g; s/\r/%0D/g' || echo "$CDK_DIFF_OUTPUT")

# For summary, use printf to avoid adding newline
SUMMARY_ESCAPED=$(printf '%s' "$SUMMARY" | sed 's/%/%25/g' || echo "$SUMMARY")

# Output variables for GitHub Actions
# Check if we're running in GitHub Actions (GITHUB_OUTPUT exists)
if [[ -n "$GITHUB_OUTPUT" ]]; then
    echo "summary=$SUMMARY_ESCAPED" >> "$GITHUB_OUTPUT"
    echo "full_output<<EOF" >> "$GITHUB_OUTPUT"
    echo "$CDK_DIFF_OUTPUT" >> "$GITHUB_OUTPUT"
    echo "EOF" >> "$GITHUB_OUTPUT"
else
    # Local testing - output to stdout
    echo "summary=$SUMMARY_ESCAPED"
    echo "full_output=$CDK_DIFF_OUTPUT"
    # Debug output only for local testing
    echo "DEBUG: Stack count: $STACK_COUNT"
    echo "DEBUG: Resource changes: $RESOURCE_CHANGES"
fi