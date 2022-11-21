import * as React from 'react'
import { Account } from '../../../models/account'
import { DialogContent } from '../../common/dialog'

interface IAccountsProps {
  readonly dotComAccount: Account | null
  readonly enterpriseAccount: Account | null

  readonly onDotComSignIn: () => void
  readonly onEnterpriseSignIn: () => void
  readonly onLogout: (account: Account) => void
}

export class Accounts extends React.Component<IAccountsProps, {}> {
  public render() {
    return (
      <DialogContent className="accounts-tab">
        <h2>GitHub.com</h2>

        <h2>GitHub Enterprise</h2>
      </DialogContent>
    )
  }

}
