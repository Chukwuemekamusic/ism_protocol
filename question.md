emit FallbackActivated in \_getPriceData requires the function to change from view;

Function cannot be declared as view because this expression (potentially) modifies the state.

rm -rf lib/v3-core

1. I know Position struct in lendingPool is to keep track of collateral and borrow shares, but how do i keep track of the user's supply of liquidity to the pool ? is it by checking the poolToken balance ? should we create a function for users to check their poolToken balance ? and their share of the pool ?
